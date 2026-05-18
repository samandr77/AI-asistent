from __future__ import annotations
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from auth import get_current_user_id
from database import get_supabase
from models.reflection import ReflectionCreate, ReflectionUpdate, Reflection, DailySummary, ReflectionStats
from services.reflection_stats import compute_daily_summary, compute_streak

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _rate_limit = _limiter.limit("10/minute")
except ModuleNotFoundError:
    def _rate_limit(func):
        return func

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_date(client_tz_offset: Optional[str]) -> date:
    """Return today's date in user's local timezone if offset header present, else UTC."""
    if client_tz_offset:
        try:
            offset_minutes = int(client_tz_offset)
            from datetime import timezone as _tz, timedelta
            tz = _tz(timedelta(minutes=offset_minutes))
            return datetime.now(tz).date()
        except (ValueError, OverflowError):
            pass
    return datetime.now(timezone.utc).date()


def _resolve_summary_date(summary_date: Optional[str], client_tz_offset: Optional[str]) -> date:
    if summary_date:
        try:
            return date.fromisoformat(summary_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="date must be ISO format YYYY-MM-DD")
    return _resolve_date(client_tz_offset)


def _row_to_reflection(r: dict) -> Reflection:
    return Reflection(
        id=r["id"],
        user_id=r["user_id"],
        date=r["date"],
        mood=r["mood"],
        energy=r["energy"],
        notes=r.get("notes"),
        completed_count=r["completed_count"],
        goal_aligned_count=r["goal_aligned_count"],
        active_goal_ids=r.get("active_goal_ids") or [],
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


@router.get("/today/summary", response_model=DailySummary)
async def get_today_summary(
    request: Request,
    tz_offset: Optional[str] = Query(None, alias="tz_offset"),
    summary_date: Optional[str] = Query(None, alias="date"),
    user_id: str = Depends(get_current_user_id),
) -> DailySummary:
    tz_header = request.headers.get("X-Timezone-Offset") or tz_offset
    target_date = _resolve_summary_date(summary_date, tz_header)
    return compute_daily_summary(user_id, target_date)


@router.get("/stats", response_model=ReflectionStats)
async def get_stats(
    user_id: str = Depends(get_current_user_id),
) -> ReflectionStats:
    return compute_streak(user_id)


@router.get("/", response_model=list[Reflection])
async def list_reflections(
    limit: int = 30,
    before: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
) -> list[Reflection]:
    db = get_supabase()
    q = db.table("daily_reflections").select("*").eq("user_id", user_id)
    if before:
        q = q.lt("date", before)
    result = q.order("date", desc=True).limit(limit).execute()
    return [_row_to_reflection(r) for r in (result.data or [])]


@router.get("/{ref_date}", response_model=Reflection)
async def get_by_date(
    ref_date: str,
    user_id: str = Depends(get_current_user_id),
) -> Reflection:
    try:
        date.fromisoformat(ref_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be ISO format YYYY-MM-DD")
    db = get_supabase()
    result = (
        db.table("daily_reflections")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", ref_date)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Reflection not found")
    return _row_to_reflection(result.data[0])


@router.post("/", status_code=201, response_model=Reflection)
async def create_reflection(
    request: Request,
    body: ReflectionCreate,
    user_id: str = Depends(get_current_user_id),
) -> Reflection:
    tz_header = request.headers.get("X-Timezone-Offset")
    target_date = body.date if body.date else _resolve_date(tz_header)

    # Compute server-side task metrics
    summary = compute_daily_summary(user_id, target_date)
    completed_count = len(summary.completed_tasks)
    goal_aligned_count = len(summary.goal_aligned_tasks)
    active_goal_ids = [g.id for g in summary.goals_with_progress]

    db = get_supabase()
    now = _now_iso()

    row = {
        "user_id": user_id,
        "date": target_date.isoformat(),
        "mood": body.mood,
        "energy": body.energy,
        "notes": body.notes,
        "completed_count": completed_count,
        "goal_aligned_count": goal_aligned_count,
        "active_goal_ids": active_goal_ids,
        "created_at": now,
        "updated_at": now,
    }

    # Upsert: update if exists for same (user_id, date)
    existing = (
        db.table("daily_reflections")
        .select("id")
        .eq("user_id", user_id)
        .eq("date", target_date.isoformat())
        .execute()
    )
    if existing.data:
        ref_id = existing.data[0]["id"]
        update_row = {
            "mood": body.mood,
            "energy": body.energy,
            "notes": body.notes,
            "completed_count": completed_count,
            "goal_aligned_count": goal_aligned_count,
            "active_goal_ids": active_goal_ids,
            "updated_at": now,
        }
        result = (
            db.table("daily_reflections")
            .update(update_row)
            .eq("id", ref_id)
            .execute()
        )
    else:
        result = db.table("daily_reflections").insert(row).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save reflection")
    return _row_to_reflection(result.data[0])


@router.patch("/{reflection_id}", response_model=Reflection)
async def update_reflection(
    reflection_id: str,
    request: Request,
    body: ReflectionUpdate,
    user_id: str = Depends(get_current_user_id),
) -> Reflection:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()

    db = get_supabase()
    result = (
        db.table("daily_reflections")
        .update(updates)
        .eq("id", reflection_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Reflection not found")
    return _row_to_reflection(result.data[0])


@router.delete("/{reflection_id}", status_code=204, response_class=Response)
async def delete_reflection(
    reflection_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    db = get_supabase()
    result = (
        db.table("daily_reflections")
        .delete()
        .eq("id", reflection_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Reflection not found")
    return Response(status_code=204)
