from __future__ import annotations
import io
from importlib.util import find_spec
from datetime import datetime, timezone

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, field_validator

from auth import get_current_user_id
from config import settings
from database import get_supabase
from services.stt import transcribe_audio_with_fallback
from services.parser import parse_dump
from services.goal_ranker import rank_today_top3
from services.premium import get_user_premium, get_daily_dump_limit, get_ai_tier_policy
from services import ai_budget
from services.task_capture import save_parsed_dump
from models.task import ParsedDump

router = APIRouter()

MAX_AUDIO_SIZE = 25 * 1024 * 1024
HAS_MULTIPART = find_spec("python_multipart") is not None or find_spec("multipart") is not None


class TextDumpRequest(BaseModel):
    text: str
    user_context: dict = {}

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("text cannot be empty")
        if len(v) > 20_000:
            raise ValueError("text too long (max 20000 chars)")
        return v


def _audio_duration_seconds(audio_bytes: bytes) -> float | None:
    """Best-effort duration probe via mutagen. Returns None if the format is unknown."""
    try:
        from mutagen import File as MutagenFile
        mf = MutagenFile(io.BytesIO(audio_bytes))
        if mf is None or mf.info is None:
            return None
        return float(mf.info.length)
    except Exception:
        return None


def _fetch_active_goals(user_id: str) -> list[dict]:
    try:
        db = get_supabase()
        result = (
            db.table("goals")
            .select("id,title,status,target_date")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )
        return result.data or []
    except Exception:
        return []


def _count_today_dumps(user_id: str) -> int:
    db = get_supabase()
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    result = (
        db.table("dumps")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", today_start)
        .execute()
    )
    return result.count or 0


async def _enforce_dump_limit(user_id: str):
    """Raises HTTP 402 if the free-tier daily dump limit is exceeded. Returns PremiumStatus."""
    premium = await get_user_premium(user_id)
    limit = get_daily_dump_limit(premium)
    if limit is float("inf") or premium.is_premium:
        return premium
    count = _count_today_dumps(user_id)
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "dump_limit_reached",
                "upgrade_url": "/premium/paywall",
                "limit": limit,
                "used": count,
            },
        )
    return premium


async def _enforce_ai_budget(user_id: str) -> None:
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=429, detail="Daily AI budget exceeded")


async def save_tasks(parsed: ParsedDump, user_id: str, raw_text: str) -> tuple[str, list[str]]:
    dump_id, task_ids, _rows = save_parsed_dump(parsed, user_id, raw_text)
    return dump_id, task_ids


@router.get("/{dump_id}/result")
async def get_dump_result(
    dump_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    dump_result = (
        db.table("dumps")
        .select("id,status")
        .eq("id", dump_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not dump_result.data:
        raise HTTPException(status_code=404, detail="Dump not found")

    tasks_result = (
        db.table("tasks")
        .select("*")
        .eq("dump_id", dump_id)
        .eq("user_id", user_id)
        .order("priority", desc=True)
        .execute()
    )
    tasks = tasks_result.data or []
    today_top3 = [
        task for task in tasks if task.get("is_today") and not task.get("is_done")
    ][:3]
    return {
        "dump_id": dump_id,
        "tasks": tasks,
        "today_top3": today_top3,
        "task_ids": [task["id"] for task in tasks],
    }


@router.post("/text")
async def dump_text(
    body: TextDumpRequest,
    user_id: str = Depends(get_current_user_id),
):
    premium = await _enforce_dump_limit(user_id)
    await _enforce_ai_budget(user_id)
    active_goals = _fetch_active_goals(user_id)
    tier_policy = get_ai_tier_policy(premium)
    try:
        result = await parse_dump(
            body.text, body.user_context,
            active_goals=active_goals, tier_policy=tier_policy,
        )
    except ValueError as e:
        sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=422, detail=str(e))
    await ai_budget.record_usage(user_id, result.tokens)
    dump_id, task_ids = await save_tasks(result.parsed, user_id, body.text)
    top3 = rank_today_top3(result.parsed.tasks, active_goals)
    return {
        "dump_id": dump_id,
        "tasks": [t.model_dump() for t in result.parsed.tasks],
        "today_top3": [t.model_dump() for t in top3],
        "task_ids": task_ids,
    }


if HAS_MULTIPART:
    @router.post("/voice")
    async def dump_voice(
        file: UploadFile,
        user_id: str = Depends(get_current_user_id),
    ):
        premium = await _enforce_dump_limit(user_id)
        await _enforce_ai_budget(user_id)
        audio_bytes = await file.read()
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

        filename = file.filename or "audio.m4a"
        duration = _audio_duration_seconds(audio_bytes)
        if duration is not None and duration > settings.max_audio_seconds:
            raise HTTPException(
                status_code=413,
                detail=f"Audio too long (max {settings.max_audio_seconds}s, got {int(duration)}s)",
            )

        try:
            transcription = await transcribe_audio_with_fallback(audio_bytes, filename)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        active_goals = _fetch_active_goals(user_id)
        tier_policy = get_ai_tier_policy(premium)
        try:
            result = await parse_dump(
                transcription, {},
                active_goals=active_goals, tier_policy=tier_policy,
            )
        except ValueError as e:
            sentry_sdk.capture_exception(e)
            raise HTTPException(status_code=422, detail=str(e))
        await ai_budget.record_usage(user_id, result.tokens)
        dump_id, task_ids = await save_tasks(result.parsed, user_id, transcription)
        top3 = rank_today_top3(result.parsed.tasks, active_goals)
        return {
            "dump_id": dump_id,
            "transcription": transcription,
            "tasks": [t.model_dump() for t in result.parsed.tasks],
            "today_top3": [t.model_dump() for t in top3],
            "task_ids": task_ids,
        }
else:
    @router.post("/voice")
    async def dump_voice_unavailable(
        user_id: str = Depends(get_current_user_id),
    ):
        raise HTTPException(
            status_code=503,
            detail="Voice upload requires python-multipart to be installed",
        )
