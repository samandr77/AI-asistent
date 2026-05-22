from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from database import get_supabase
from fastapi import HTTPException

from models.task import RecurrenceUpdate, TaskStatus
from services.task_utils import assert_found, load_task_for_user, now_iso


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def next_occurrence(current: date, rule: dict | None) -> date:
    rule = rule or {}
    frequency = rule.get("frequency", "daily")
    interval = max(int(rule.get("interval") or 1), 1)
    if frequency == "weekdays":
        candidate = current + timedelta(days=1)
        while candidate.weekday() >= 5:
            candidate += timedelta(days=1)
        return candidate
    if frequency == "weekly":
        return current + timedelta(weeks=interval)
    if frequency == "monthly":
        month_index = current.month - 1 + interval
        year = current.year + month_index // 12
        month = month_index % 12 + 1
        return date(year, month, min(current.day, 28))
    return current + timedelta(days=interval)


def _as_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def get_recurrence(task_id: str, user_id: str) -> dict:
    task = load_task_for_user(task_id, user_id)
    return {
        "task_id": task_id,
        "recurrence_rule": task.get("recurrence_rule"),
        "next_occurrence_at": task.get("next_occurrence_at"),
        "habit_mode": bool(task.get("habit_mode")),
        "rollover_count": int(task.get("rollover_count") or 0),
    }


def put_recurrence(task_id: str, body: RecurrenceUpdate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    rule = {
        "frequency": body.frequency.value,
        "interval": body.interval,
        "days_of_week": body.days_of_week,
    }
    next_due = body.next_occurrence_at or _as_datetime(next_occurrence(date.today(), rule))
    result = (
        get_supabase()
        .table("tasks")
        .update(
            {
                "recurrence_rule": rule,
                "next_occurrence_at": next_due.isoformat(),
                "habit_mode": body.habit_mode,
                "updated_at": now_iso(),
            }
        )
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def delete_recurrence(task_id: str, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("tasks")
        .update(
            {
                "recurrence_rule": None,
                "next_occurrence_at": None,
                "habit_mode": False,
                "updated_at": now_iso(),
            }
        )
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def complete_recurring_task(task_id: str, user_id: str) -> dict:
    task = load_task_for_user(task_id, user_id)
    completed_at = now_iso()
    updates: dict = {
        "status": TaskStatus.done.value,
        "is_done": True,
        "completed_at": completed_at,
        "updated_at": completed_at,
    }
    rule = task.get("recurrence_rule")
    if rule:
        if task.get("habit_mode"):
            get_supabase().table("task_habit_events").insert(
                {
                    "user_id": user_id,
                    "task_id": task_id,
                    "event_date": date.today().isoformat(),
                    "completed": True,
                    "completed_at": completed_at,
                    "created_at": completed_at,
                }
            ).execute()
        current = _parse_date(task.get("next_occurrence_at")) or _parse_date(task.get("deadline")) or date.today()
        next_due = next_occurrence(current, rule)
        updates.update(
            {
                "status": TaskStatus.active.value,
                "is_done": False,
                "completed_at": completed_at,
                "deadline": next_due.isoformat(),
                "next_occurrence_at": next_due.isoformat(),
                "rollover_count": int(task.get("rollover_count") or 0) + 1,
            }
        )
    result = (
        get_supabase()
        .table("tasks")
        .update(updates)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def rollover_task(task_id: str, user_id: str) -> dict:
    task = load_task_for_user(task_id, user_id)
    due = _parse_date(task.get("next_occurrence_at")) or _parse_date(task.get("deadline")) or date.today()
    next_due = next_occurrence(due, task.get("recurrence_rule"))
    result = (
        get_supabase()
        .table("tasks")
        .update(
            {
                "deadline": next_due.isoformat(),
                "next_occurrence_at": next_due.isoformat(),
                "rollover_count": int(task.get("rollover_count") or 0) + 1,
                "updated_at": now_iso(),
            }
        )
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def rollover_due_recurring(user_id: str, today: date | None = None) -> list[dict]:
    target = today or datetime.now(timezone.utc).date()
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_done", False)
        .lte("next_occurrence_at", target.isoformat())
        .execute()
    )
    rolled: list[dict] = []
    for task in result.data or []:
        due = _parse_date(task.get("next_occurrence_at")) or target
        next_due = next_occurrence(due, task.get("recurrence_rule"))
        result_update = (
            get_supabase()
            .table("tasks")
            .update(
                {
                    "deadline": next_due.isoformat(),
                    "next_occurrence_at": next_due.isoformat(),
                    "rollover_count": int(task.get("rollover_count") or 0) + 1,
                    "updated_at": now_iso(),
                }
            )
            .eq("id", task["id"])
            .eq("user_id", user_id)
            .execute()
        )
        if result_update.data:
            rolled.append(result_update.data[0])
    return rolled


def list_habits(user_id: str) -> list[dict]:
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("habit_mode", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def habit_stats(task_id: str, user_id: str) -> dict:
    task = load_task_for_user(task_id, user_id)
    if not task.get("habit_mode"):
        raise HTTPException(status_code=422, detail="Task is not a habit")
    events = habit_history(task_id, user_id, days=90)["events"]
    focus = (
        get_supabase()
        .table("task_focus_sessions")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    sessions = focus.data or []
    completed_dates = {
        str(row.get("event_date")) for row in events if row.get("completed")
    }
    today = date.today()
    current_streak = 0
    cursor = today
    while cursor.isoformat() in completed_dates:
        current_streak += 1
        cursor -= timedelta(days=1)
    longest_streak = 0
    streak = 0
    for offset in range(89, -1, -1):
        day = today - timedelta(days=offset)
        if day.isoformat() in completed_dates:
            streak += 1
            longest_streak = max(longest_streak, streak)
        else:
            streak = 0
    return {
        "task_id": task_id,
        "rollover_count": int(task.get("rollover_count") or 0),
        "next_occurrence_at": task.get("next_occurrence_at"),
        "completed_count_90d": len(completed_dates),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "completion_rate_90d": round(len(completed_dates) / 90, 4),
        "focus_sessions": len(sessions),
        "focus_minutes": sum(int(row.get("duration_min") or 0) for row in sessions),
    }


def habit_history(task_id: str, user_id: str, days: int = 30) -> dict:
    load_task_for_user(task_id, user_id)
    days = min(max(days, 1), 365)
    start = date.today() - timedelta(days=days - 1)
    result = (
        get_supabase()
        .table("task_habit_events")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .gte("event_date", start.isoformat())
        .order("event_date", desc=False)
        .execute()
    )
    return {"task_id": task_id, "days": days, "events": result.data or []}
