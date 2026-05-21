from __future__ import annotations

from datetime import date

from services.weekly_review_builder import build_review_draft, iso_week_start


def test_iso_week_start_returns_monday():
    # 2026-05-21 is a Thursday
    assert iso_week_start(date(2026, 5, 21)) == date(2026, 5, 18)


def test_iso_week_start_returns_self_for_monday():
    monday = date(2026, 5, 18)
    assert iso_week_start(monday) == monday


def test_build_draft_counts_and_top_5():
    completed = [
        {"id": str(i), "title": f"T{i}", "sphere": "work", "priority": i % 4}
        for i in range(8)
    ]
    carried = [{"id": str(i), "title": f"C{i}"} for i in range(6)]
    goals = [
        {
            "id": "g1",
            "title": "Запустить SaaS",
            "level": "quarter",
            "progress_percent": 20,
            "computed_progress": 20,
            "key_results_done_count": 0,
            "key_results_count": 2,
        }
    ]

    draft = build_review_draft(date(2026, 5, 18), completed, carried, goals)

    assert draft["week_start"] == date(2026, 5, 18)
    assert draft["week_end"] == date(2026, 5, 24)
    assert draft["completed_tasks_count"] == 8
    assert draft["carried_over_count"] == 6
    assert draft["active_goals"] == 1
    assert len(draft["top_completed"]) == 5
    assert draft["okr_progress"][0]["title"] == "Запустить SaaS"
    assert any("Перенесено" in s for s in draft["suggestions"])
    assert any("OKR" in s for s in draft["suggestions"])
