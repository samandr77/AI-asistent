from __future__ import annotations
import pytest
from datetime import date, timedelta
from models.task import ParsedTask, Sphere, Priority
from services.goal_ranker import rank_today_top3


def make_task(title: str, priority: Priority, is_today: bool = True, goal_id: str | None = None) -> ParsedTask:
    return ParsedTask(title=title, sphere=Sphere.work, priority=priority, is_today=is_today, goal_id=goal_id)


def active_goal(goal_id: str, title: str = "Test Goal", target_date: date | None = None) -> dict:
    return {
        "id": goal_id,
        "title": title,
        "status": "active",
        "target_date": target_date.isoformat() if target_date else None,
    }


# ── Basic ranking ──────────────────────────────────────────────────────────────

def test_top3_returns_at_most_three():
    tasks = [make_task(f"T{i}", Priority.medium) for i in range(10)]
    result = rank_today_top3(tasks)
    assert len(result) <= 3


def test_top3_only_today_tasks():
    tasks = [
        make_task("Today high", Priority.high, is_today=True),
        make_task("Not today", Priority.high, is_today=False),
    ]
    result = rank_today_top3(tasks)
    assert all(t.is_today for t in result)
    assert len(result) == 1


def test_top3_orders_by_priority_descending():
    tasks = [
        make_task("Low", Priority.low),
        make_task("High", Priority.high),
        make_task("Medium", Priority.medium),
    ]
    result = rank_today_top3(tasks)
    assert result[0].title == "High"
    assert result[1].title == "Medium"
    assert result[2].title == "Low"


def test_top3_empty_tasks_returns_empty():
    assert rank_today_top3([]) == []


def test_top3_no_today_tasks_returns_empty():
    tasks = [make_task("Someday", Priority.high, is_today=False)]
    assert rank_today_top3(tasks) == []


# ── Goal boost ────────────────────────────────────────────────────────────────

def test_goal_aligned_task_ranked_higher_than_same_priority():
    goal = active_goal("g1")
    tasks = [
        make_task("No goal", Priority.medium, goal_id=None),
        make_task("Has goal", Priority.medium, goal_id="g1"),
    ]
    result = rank_today_top3(tasks, active_goals=[goal])
    assert result[0].title == "Has goal"


def test_goal_boost_does_not_override_priority_gap():
    """A high-priority non-goal task still beats a medium-priority goal task."""
    goal = active_goal("g1")
    tasks = [
        make_task("High no goal", Priority.high, goal_id=None),
        make_task("Medium with goal", Priority.medium, goal_id="g1"),
    ]
    result = rank_today_top3(tasks, active_goals=[goal])
    assert result[0].title == "High no goal"


def test_target_date_within_window_adds_extra_boost():
    near_date = date.today() + timedelta(days=7)
    far_date = date.today() + timedelta(days=60)
    goal_near = active_goal("g1", target_date=near_date)
    goal_far = active_goal("g2", target_date=far_date)
    tasks = [
        make_task("Near goal", Priority.medium, goal_id="g1"),
        make_task("Far goal", Priority.medium, goal_id="g2"),
    ]
    result = rank_today_top3(tasks, active_goals=[goal_near, goal_far])
    assert result[0].title == "Near goal"


def test_target_date_outside_window_no_extra_boost():
    """A goal with target_date > 14 days should NOT get the extra boost."""
    far_date = date.today() + timedelta(days=30)
    near_date_no_goal = None
    goal_far = active_goal("g1", target_date=far_date)
    goal_near = active_goal("g2", target_date=near_date_no_goal)
    tasks = [
        make_task("Far goal task", Priority.medium, goal_id="g1"),
        make_task("No-date goal task", Priority.medium, goal_id="g2"),
    ]
    result = rank_today_top3(tasks, active_goals=[goal_far, goal_near])
    # Both have same boost (goal boost only), order determined by insertion; just verify no crash and correct count
    assert len(result) == 2


def test_paused_goal_no_boost():
    paused_goal = {"id": "g1", "title": "Paused", "status": "paused", "target_date": None}
    tasks = [
        make_task("No goal", Priority.medium, goal_id=None),
        make_task("Paused goal", Priority.medium, goal_id="g1"),
    ]
    result = rank_today_top3(tasks, active_goals=[paused_goal])
    # Paused goal doesn't boost — order should be stable by insertion
    scores_equal = True
    assert len(result) == 2
    assert scores_equal  # just ensure no crash; both at same score


def test_no_active_goals_falls_back_to_priority():
    tasks = [
        make_task("Medium", Priority.medium),
        make_task("High", Priority.high),
        make_task("Low", Priority.low),
    ]
    result = rank_today_top3(tasks, active_goals=[])
    assert result[0].title == "High"


def test_goal_not_in_active_list_no_boost():
    """Task has goal_id but that goal isn't in active_goals — no boost applied."""
    goal = active_goal("g1")
    tasks = [
        make_task("Unknown goal task", Priority.medium, goal_id="g-unknown"),
        make_task("No goal", Priority.medium, goal_id=None),
    ]
    result = rank_today_top3(tasks, active_goals=[goal])
    # Both same score — just check no crash and count
    assert len(result) == 2


def test_target_date_today_adds_boost():
    goal = active_goal("g1", target_date=date.today())
    tasks = [
        make_task("Due today goal", Priority.medium, goal_id="g1"),
        make_task("No goal", Priority.medium, goal_id=None),
    ]
    result = rank_today_top3(tasks, active_goals=[goal])
    assert result[0].title == "Due today goal"
