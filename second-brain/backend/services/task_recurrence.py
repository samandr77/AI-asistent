from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from database import get_supabase
from services.task_utils import now_iso


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
