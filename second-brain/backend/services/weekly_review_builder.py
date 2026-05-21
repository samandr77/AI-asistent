"""Weekly review draft builder.

Aggregates completed tasks, OKR progress, and quick suggestions for the
current ISO week so the UI can pre-fill the review form.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List


def iso_week_start(reference: date) -> date:
    """Return Monday of the ISO week containing the reference date."""
    return reference - timedelta(days=reference.weekday())


def build_review_draft(
    week_start: date,
    completed_tasks: List[Dict[str, Any]],
    carried_over_tasks: List[Dict[str, Any]],
    goals_with_progress: List[Dict[str, Any]],
) -> Dict[str, Any]:
    week_end = week_start + timedelta(days=6)

    top_completed = sorted(
        completed_tasks,
        key=lambda t: (t.get("priority") or 99),
    )[:5]

    okr_progress = [
        {
            "goal_id": g.get("id"),
            "title": g.get("title"),
            "level": g.get("level"),
            "computed_progress": g.get("computed_progress", g.get("progress_percent", 0)),
            "key_results_done": g.get("key_results_done_count", 0),
            "key_results_total": g.get("key_results_count", 0),
        }
        for g in goals_with_progress
    ]

    suggestions: List[str] = []
    if len(carried_over_tasks) >= 5:
        suggestions.append(
            "Перенесено больше 5 задач — пересмотри планирование на неделю."
        )
    stagnating = [g for g in okr_progress if g["computed_progress"] < 25]
    if stagnating:
        suggestions.append(
            f"{len(stagnating)} OKR с прогрессом < 25% — добавь конкретные задачи."
        )
    if not suggestions:
        suggestions.append("Прогресс ровный — закрепи привычки следующей неделей.")

    return {
        "week_start": week_start,
        "week_end": week_end,
        "completed_tasks_count": len(completed_tasks),
        "carried_over_count": len(carried_over_tasks),
        "active_goals": len(goals_with_progress),
        "okr_progress": okr_progress,
        "top_completed": [
            {
                "id": t.get("id"),
                "title": t.get("title"),
                "sphere": t.get("sphere"),
            }
            for t in top_completed
        ],
        "suggestions": suggestions,
    }
