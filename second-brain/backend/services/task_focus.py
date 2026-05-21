from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException

from database import get_supabase
from models.task import FocusSessionCreate, FocusSessionUpdate, FocusSettingsUpdate
from services.task_utils import assert_found, now_iso, payload_from_model


DEFAULT_FOCUS_SETTINGS = {
    "pomodoro_min": 25,
    "short_break_min": 5,
    "long_break_min": 15,
    "sessions_before_long_break": 4,
    "sound_enabled": True,
    "dnd_enabled": False,
}


def _load_task_for_user(task_id: str, user_id: str) -> dict:
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def _duration(body: FocusSessionCreate | FocusSessionUpdate) -> int | None:
    if body.duration_min is not None:
        return body.duration_min
    if body.started_at is not None and body.ended_at is not None:
        return max(1, round((body.ended_at - body.started_at).total_seconds() / 60))
    return None


def create_session(task_id: str, body: FocusSessionCreate, user_id: str) -> dict:
    _load_task_for_user(task_id, user_id)
    row = payload_from_model(body)
    row["duration_min"] = _duration(body) or DEFAULT_FOCUS_SETTINGS["pomodoro_min"]
    row.update({"user_id": user_id, "task_id": task_id, "created_at": now_iso()})
    result = get_supabase().table("task_focus_sessions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create focus session")
    task = _load_task_for_user(task_id, user_id)
    current = int(task.get("duration_actual_min") or 0)
    get_supabase().table("tasks").update(
        {"duration_actual_min": current + int(row["duration_min"]), "updated_at": now_iso()}
    ).eq("id", task_id).eq("user_id", user_id).execute()
    return result.data[0]


def list_task_sessions(task_id: str, user_id: str) -> list[dict]:
    _load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_focus_sessions")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .execute()
    )
    return result.data or []


def list_sessions(user_id: str, date_from: date | None = None, date_to: date | None = None) -> list[dict]:
    query = get_supabase().table("task_focus_sessions").select("*").eq("user_id", user_id)
    if date_from:
        query = query.gte("started_at", date_from.isoformat())
    if date_to:
        query = query.lte("started_at", date_to.isoformat())
    result = query.order("started_at", desc=True).execute()
    return result.data or []


def update_session(session_id: str, body: FocusSessionUpdate, user_id: str) -> dict:
    updates = payload_from_model(body, partial=True)
    computed_duration = _duration(body)
    if computed_duration is not None:
        updates["duration_min"] = computed_duration
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    result = (
        get_supabase()
        .table("task_focus_sessions")
        .update(updates)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Focus session not found")


def delete_session(session_id: str, user_id: str) -> None:
    result = (
        get_supabase()
        .table("task_focus_sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Focus session not found")


def summary(user_id: str, date_from: date | None = None, date_to: date | None = None) -> dict:
    rows = list_sessions(user_id, date_from, date_to)
    completed = [row for row in rows if row.get("completed", True)]
    total_minutes = sum(int(row.get("duration_min") or 0) for row in completed)
    by_mode: dict[str, int] = {}
    by_day: dict[str, int] = {}
    for row in completed:
        mode = str(row.get("mode") or "pomodoro")
        by_mode[mode] = by_mode.get(mode, 0) + int(row.get("duration_min") or 0)
        started = row.get("started_at")
        day = str(started)[:10] if started else "unknown"
        by_day[day] = by_day.get(day, 0) + int(row.get("duration_min") or 0)
    return {
        "sessions_count": len(rows),
        "completed_count": len(completed),
        "focus_minutes": total_minutes,
        "by_mode": by_mode,
        "by_day": by_day,
    }


def get_settings(user_id: str) -> dict:
    result = (
        get_supabase()
        .table("task_focus_settings")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return {"user_id": user_id, **DEFAULT_FOCUS_SETTINGS}


def put_settings(body: FocusSettingsUpdate, user_id: str) -> dict:
    existing = get_settings(user_id)
    row = payload_from_model(body)
    row.update({"user_id": user_id, "updated_at": now_iso()})
    if existing.get("id"):
        result = (
            get_supabase()
            .table("task_focus_settings")
            .update(row)
            .eq("id", existing["id"])
            .eq("user_id", user_id)
            .execute()
        )
    else:
        row["created_at"] = datetime.now(timezone.utc).isoformat()
        result = get_supabase().table("task_focus_settings").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save focus settings")
    return result.data[0]
