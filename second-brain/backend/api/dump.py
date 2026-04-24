from __future__ import annotations
from importlib.util import find_spec
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, field_validator
from auth import get_current_user_id
from database import get_supabase
from services.stt import transcribe_audio_with_fallback
from services.parser import parse_dump
from services.goal_ranker import rank_today_top3
from services.premium import get_user_premium, get_daily_dump_limit
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
        return v


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
    """Count dumps created by this user today (UTC date)."""
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


async def _enforce_dump_limit(user_id: str) -> None:
    """Raises HTTP 402 if the free-tier daily dump limit is exceeded."""
    premium = await get_user_premium(user_id)
    limit = get_daily_dump_limit(premium)
    if limit is float("inf") or premium.is_premium:
        return
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


async def save_tasks(parsed: ParsedDump, user_id: str, raw_text: str) -> tuple[str, list[str]]:
    db = get_supabase()
    dump_result = db.table("dumps").insert({
        "user_id": user_id,
        "raw_text": raw_text,
        "status": "done",
    }).execute()
    if not dump_result.data:
        raise HTTPException(status_code=500, detail="Failed to save dump")
    dump_id = dump_result.data[0]["id"]

    rows = [
        {
            "user_id": user_id,
            "dump_id": dump_id,
            "title": t.title,
            "sphere": t.sphere.value,
            "priority": t.priority.value,
            "is_today": t.is_today,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "notes": t.notes,
            "goal_id": t.goal_id if t.goal_id else None,
        }
        for t in parsed.tasks
    ]
    task_result = db.table("tasks").insert(rows).execute()
    if not task_result.data:
        raise HTTPException(status_code=500, detail="Failed to save tasks")
    task_ids = [r["id"] for r in task_result.data]
    return dump_id, task_ids


@router.post("/text")
async def dump_text(
    body: TextDumpRequest,
    user_id: str = Depends(get_current_user_id),
):
    await _enforce_dump_limit(user_id)
    active_goals = _fetch_active_goals(user_id)
    try:
        parsed = await parse_dump(body.text, body.user_context, active_goals=active_goals)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    dump_id, task_ids = await save_tasks(parsed, user_id, body.text)
    top3 = rank_today_top3(parsed.tasks, active_goals)
    return {
        "dump_id": dump_id,
        "tasks": [t.model_dump() for t in parsed.tasks],
        "today_top3": [t.model_dump() for t in top3],
        "task_ids": task_ids,
    }


if HAS_MULTIPART:
    @router.post("/voice")
    async def dump_voice(
        file: UploadFile,
        user_id: str = Depends(get_current_user_id),
    ):
        await _enforce_dump_limit(user_id)
        audio_bytes = await file.read()
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

        transcription = await transcribe_audio_with_fallback(audio_bytes, file.filename or "audio.m4a")
        active_goals = _fetch_active_goals(user_id)
        try:
            parsed = await parse_dump(transcription, {}, active_goals=active_goals)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        dump_id, task_ids = await save_tasks(parsed, user_id, transcription)
        top3 = rank_today_top3(parsed.tasks, active_goals)
        return {
            "dump_id": dump_id,
            "transcription": transcription,
            "tasks": [t.model_dump() for t in parsed.tasks],
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
