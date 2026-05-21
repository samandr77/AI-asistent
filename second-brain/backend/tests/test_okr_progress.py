from __future__ import annotations

from services.okr_progress import (
    aggregate_goal_progress,
    build_okr_tree,
    compute_kr_progress,
    derive_kr_status,
)


def test_kr_progress_increase():
    kr = {"start_value": 0, "target_value": 100, "current_value": 25}
    assert compute_kr_progress(kr) == 25


def test_kr_progress_increase_overshoot_caps_at_100():
    kr = {"start_value": 0, "target_value": 100, "current_value": 150}
    assert compute_kr_progress(kr) == 100


def test_kr_progress_decrease():
    kr = {
        "start_value": 100,
        "target_value": 60,
        "current_value": 80,
        "direction": "decrease",
    }
    assert compute_kr_progress(kr) == 50


def test_kr_progress_maintain_within_target():
    kr = {
        "start_value": 0,
        "target_value": 70,
        "current_value": 70,
        "direction": "maintain",
    }
    assert compute_kr_progress(kr) == 100


def test_kr_progress_maintain_deviation():
    kr = {
        "start_value": 0,
        "target_value": 100,
        "current_value": 90,
        "direction": "maintain",
    }
    # 10% deviation → 90% match
    assert compute_kr_progress(kr) == 90


def test_kr_status_done_explicit():
    assert derive_kr_status({"status": "done", "target_value": 100, "current_value": 0}) == "done"


def test_kr_status_done_by_progress():
    kr = {"start_value": 0, "target_value": 10, "current_value": 10}
    assert derive_kr_status(kr) == "done"


def test_aggregate_uses_kr_progress_when_available():
    goal = {"progress_percent": 5}
    krs = [
        {"start_value": 0, "target_value": 100, "current_value": 40},
        {"start_value": 0, "target_value": 100, "current_value": 60},
    ]
    snapshot = aggregate_goal_progress(goal, krs, [])
    assert snapshot["computed_progress"] == 50
    assert snapshot["key_results_count"] == 2


def test_aggregate_falls_back_to_tasks():
    goal = {"progress_percent": 5}
    tasks = [{"is_done": True}, {"is_done": False}]
    snapshot = aggregate_goal_progress(goal, [], tasks)
    assert snapshot["computed_progress"] == 50
    assert snapshot["linked_tasks_count"] == 2
    assert snapshot["completed_tasks_count"] == 1


def test_aggregate_falls_back_to_manual_progress():
    snapshot = aggregate_goal_progress({"progress_percent": 33}, [], [])
    assert snapshot["computed_progress"] == 33


def test_build_okr_tree_orders_by_level_and_nests_children():
    goals = [
        {"id": "y1", "level": "year", "parent_goal_id": None, "created_at": "2026-01-01"},
        {"id": "q1", "level": "quarter", "parent_goal_id": "y1", "created_at": "2026-02-01"},
        {"id": "q2", "level": "quarter", "parent_goal_id": "y1", "created_at": "2026-02-02"},
        {"id": "life", "level": "life", "parent_goal_id": None, "created_at": "2025-12-01"},
    ]
    tree = build_okr_tree(goals)
    ids = [n["goal"]["id"] for n in tree]
    assert ids == ["life", "y1"]
    y1 = next(n for n in tree if n["goal"]["id"] == "y1")
    assert [c["goal"]["id"] for c in y1["children"]] == ["q1", "q2"]
