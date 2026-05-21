"""OKR / Key Result progress computation.

Centralized rules so the API stays thin and tests stay isolated.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Iterable, List, Optional


def compute_kr_progress(kr: Dict[str, Any]) -> int:
    """Return integer 0..100 progress for a key result, respecting direction."""
    start = float(kr.get("start_value") or 0)
    target = float(kr.get("target_value") or 0)
    current = float(kr.get("current_value") or 0)
    direction = kr.get("direction") or "increase"

    if direction == "maintain":
        if target == 0:
            return 100 if current == 0 else 0
        deviation = abs(current - target) / abs(target)
        return max(0, min(100, round((1 - deviation) * 100)))

    if direction == "decrease":
        if start == target:
            return 100 if current <= target else 0
        progress = (start - current) / (start - target)
    else:  # increase
        if target == start:
            return 100 if current >= target else 0
        progress = (current - start) / (target - start)

    return max(0, min(100, round(progress * 100)))


def derive_kr_status(kr: Dict[str, Any], today: Optional[date] = None) -> str:
    """Return 'done' | 'on_track' | 'at_risk' | 'off_track' based on progress + due."""
    explicit = kr.get("status")
    if explicit == "done":
        return "done"

    progress = compute_kr_progress(kr)
    if progress >= 100:
        return "done"

    due_raw = kr.get("due_date")
    if not due_raw:
        return explicit or ("on_track" if progress >= 50 else "at_risk")

    if isinstance(due_raw, str):
        try:
            due = date.fromisoformat(due_raw)
        except ValueError:
            return explicit or "on_track"
    elif isinstance(due_raw, date):
        due = due_raw
    else:
        return explicit or "on_track"

    today = today or date.today()
    days_left = (due - today).days
    if days_left < 0:
        return "off_track" if progress < 100 else "done"
    if days_left <= 7 and progress < 70:
        return "at_risk"
    if progress >= 80:
        return "on_track"
    return explicit or "on_track"


def aggregate_goal_progress(
    goal: Dict[str, Any],
    key_results: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute a unified progress snapshot for a goal.

    Priority: explicit KR progress > task-completion ratio > manual progress.
    """

    manual = int(goal.get("progress_percent") or 0)

    kr_progresses = [compute_kr_progress(kr) for kr in key_results]
    kr_avg = round(sum(kr_progresses) / len(kr_progresses)) if kr_progresses else None
    kr_done = sum(1 for p in kr_progresses if p >= 100)

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("is_done"))
    task_progress = (
        round((completed_tasks / total_tasks) * 100) if total_tasks else None
    )

    if kr_avg is not None:
        computed = kr_avg
    elif task_progress is not None:
        computed = task_progress
    else:
        computed = manual

    return {
        "manual_progress": manual,
        "computed_progress": computed,
        "linked_tasks_count": total_tasks,
        "completed_tasks_count": completed_tasks,
        "key_results_count": len(key_results),
        "key_results_done_count": kr_done,
    }


def build_okr_tree(
    goals: Iterable[Dict[str, Any]],
    progress_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Build a tree of goals by parent_goal_id, ordered by level then created_at."""

    progress_map = progress_map or {}
    level_order = {"life": 0, "year": 1, "quarter": 2, "week": 3}

    def attach(goal: Dict[str, Any]) -> Dict[str, Any]:
        return {**goal, **progress_map.get(goal["id"], {})}

    goals_sorted = sorted(
        goals,
        key=lambda g: (
            level_order.get(g.get("level") or "year", 99),
            g.get("created_at") or "",
        ),
    )

    by_id = {g["id"]: {"goal": attach(g), "children": []} for g in goals_sorted}
    roots: List[Dict[str, Any]] = []
    for g in goals_sorted:
        parent_id = g.get("parent_goal_id")
        node = by_id[g["id"]]
        if parent_id and parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots
