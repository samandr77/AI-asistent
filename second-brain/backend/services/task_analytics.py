from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean

from database import get_supabase


def _row_date(row: dict, key: str) -> date | None:
    value = row.get(key)
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None


def _tasks_for_range(user_id: str, date_from: date | None, date_to: date | None) -> list[dict]:
    query = get_supabase().table("tasks").select("*").eq("user_id", user_id)
    if date_from:
        query = query.gte("created_at", date_from.isoformat())
    if date_to:
        query = query.lte("created_at", date_to.isoformat())
    result = query.order("created_at", desc=False).execute()
    return result.data or []


def analytics(user_id: str, date_from: date | None = None, date_to: date | None = None) -> dict:
    rows = _tasks_for_range(user_id, date_from, date_to)
    completed = [row for row in rows if row.get("is_done") or row.get("status") == "done"]
    on_time = []
    estimates = []
    actuals = []
    for row in completed:
        deadline = _row_date(row, "deadline")
        completed_at = _row_date(row, "completed_at") or _row_date(row, "updated_at")
        if deadline and completed_at:
            on_time.append(completed_at <= deadline)
        if row.get("duration_estimated_min") and row.get("duration_actual_min"):
            estimates.append(int(row["duration_estimated_min"]))
            actuals.append(int(row["duration_actual_min"]))

    focus_result = (
        get_supabase()
        .table("task_focus_sessions")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    focus_minutes = sum(int(row.get("duration_min") or 0) for row in focus_result.data or [])
    estimate_error = (
        round(mean(abs(actual - estimate) for actual, estimate in zip(actuals, estimates)), 2)
        if estimates and actuals
        else None
    )
    return {
        "tasks_total": len(rows),
        "completed_count": len(completed),
        "goal_aligned_count": len([row for row in completed if row.get("goal_id")]),
        "on_time_rate": round(sum(on_time) / len(on_time), 4) if on_time else None,
        "estimate_error_avg_min": estimate_error,
        "rollover_count": sum(int(row.get("rollover_count") or 0) for row in rows),
        "focus_minutes": focus_minutes,
        "completed_by_sphere": _count_by(completed, "sphere"),
    }


def _count_by(rows: list[dict], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        bucket = str(row.get(key) or "none")
        counts[bucket] = counts.get(bucket, 0) + 1
    return counts


def weekly_report(user_id: str, week_start: date | None = None) -> dict:
    start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    end = start + timedelta(days=6)
    summary = analytics(user_id, start, end)
    recommendations = []
    if summary["rollover_count"] > 0:
        recommendations.append("Break down tasks that keep rolling over.")
    if summary["estimate_error_avg_min"] and summary["estimate_error_avg_min"] > 30:
        recommendations.append("Increase estimates for task types that regularly overrun.")
    if not recommendations:
        recommendations.append("Keep the current weekly rhythm and review the inbox daily.")
    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "summary": summary,
        "recommendations": recommendations,
    }
