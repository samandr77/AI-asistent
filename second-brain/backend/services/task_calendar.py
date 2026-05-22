from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from database import get_supabase
from services.task_planning import capacity, free_slots


def _day_bounds(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _tasks_between(user_id: str, start: datetime, end: datetime) -> list[dict]:
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .gte("scheduled_start", start.isoformat())
        .lt("scheduled_start", end.isoformat())
        .order("scheduled_start", desc=False)
        .execute()
    )
    return result.data or []


def calendar(user_id: str, start_date: date, days: int = 7) -> dict:
    days = min(max(days, 1), 31)
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=days)
    tasks = _tasks_between(user_id, start, end)
    by_day: dict[str, list[dict]] = {
        (start_date + timedelta(days=offset)).isoformat(): [] for offset in range(days)
    }
    for task in tasks:
        scheduled = _parse_dt(task.get("scheduled_start"))
        if not scheduled:
            continue
        by_day.setdefault(scheduled.date().isoformat(), []).append(task)
    return {
        "start_date": start_date.isoformat(),
        "end_date": (start_date + timedelta(days=days - 1)).isoformat(),
        "days": [
            {
                "date": day,
                "tasks": day_tasks,
                "capacity": capacity(user_id, date.fromisoformat(day)),
                "free_slots": free_slots(user_id, date.fromisoformat(day))["slots"],
            }
            for day, day_tasks in by_day.items()
        ],
    }


def due_reminders(user_id: str, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_done", False)
        .lte("reminder_at", now.isoformat())
        .execute()
    )
    return {"now": now.isoformat(), "tasks": result.data or []}


def mark_reminder_sent(task_id: str, user_id: str, sent_at: datetime | None = None) -> dict:
    sent_at = sent_at or datetime.now(timezone.utc)
    result = (
        get_supabase()
        .table("tasks")
        .update({"last_reminded_at": sent_at.isoformat(), "updated_at": sent_at.isoformat()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return {"task_id": task_id, "updated": False}
    return {"task_id": task_id, "updated": True, "task": result.data[0]}
