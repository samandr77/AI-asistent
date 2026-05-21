from __future__ import annotations

from datetime import date

from services.task_recurrence import next_occurrence


def test_next_occurrence_daily_interval():
    assert next_occurrence(date(2026, 5, 20), {"frequency": "daily", "interval": 2}) == date(
        2026, 5, 22
    )


def test_next_occurrence_weekdays_skips_weekend():
    assert next_occurrence(date(2026, 5, 22), {"frequency": "weekdays"}) == date(
        2026, 5, 25
    )


def test_next_occurrence_monthly_clamps_day():
    assert next_occurrence(date(2026, 1, 31), {"frequency": "monthly"}) == date(
        2026, 2, 28
    )
