from __future__ import annotations
from datetime import date, timedelta
from models.task import ParsedTask


_GOAL_BOOST = 10
_DEADLINE_BOOST = 5
_DEADLINE_WINDOW_DAYS = 14


def rank_today_top3(
    tasks: list[ParsedTask],
    active_goals: list[dict] | None = None,
) -> list[ParsedTask]:
    """Return up to 3 today tasks ranked by priority + goal-alignment boost.

    Boost rules:
    - Task with goal_id pointing to an active goal: +_GOAL_BOOST
    - Additionally, if that goal's target_date is within _DEADLINE_WINDOW_DAYS days: +_DEADLINE_BOOST
    - Tie-break: older created_at first (not available on ParsedTask — use list index as proxy)
    """
    if active_goals is None:
        active_goals = []

    goal_map: dict[str, dict] = {g["id"]: g for g in active_goals if g.get("status") == "active"}
    today_date = date.today()
    cutoff = today_date + timedelta(days=_DEADLINE_WINDOW_DAYS)

    def score(task: ParsedTask) -> int:
        base = task.priority.value * 100
        if task.goal_id and task.goal_id in goal_map:
            base += _GOAL_BOOST
            goal = goal_map[task.goal_id]
            target = goal.get("target_date")
            if target:
                if isinstance(target, str):
                    try:
                        target = date.fromisoformat(target)
                    except ValueError:
                        target = None
                if target and today_date <= target <= cutoff:
                    base += _DEADLINE_BOOST
        return base

    today = [t for t in tasks if t.is_today]
    ranked = sorted(today, key=score, reverse=True)
    return ranked[:3]
