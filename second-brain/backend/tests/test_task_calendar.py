from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

from services import task_calendar


def _chain(rows: list[dict]):
    chain = MagicMock()
    for method in ("select", "eq", "gte", "lt", "lte", "order"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = rows
    return chain


def test_calendar_groups_scheduled_tasks_by_day():
    db = MagicMock()
    db.table.return_value = _chain(
        [
            {
                "id": "task-1",
                "scheduled_start": "2026-05-21T09:00:00+00:00",
                "scheduled_end": "2026-05-21T10:00:00+00:00",
            }
        ]
    )
    with (
        patch("services.task_calendar.get_supabase", return_value=db),
        patch("services.task_calendar.capacity", return_value={"overload": False}),
        patch("services.task_calendar.free_slots", return_value={"slots": []}),
    ):
        result = task_calendar.calendar("user-1", date(2026, 5, 21), days=2)

    assert result["start_date"] == "2026-05-21"
    assert result["days"][0]["tasks"][0]["id"] == "task-1"
    assert result["days"][1]["tasks"] == []


def test_due_reminders_returns_unfinished_due_tasks():
    db = MagicMock()
    db.table.return_value = _chain([{"id": "task-1", "reminder_at": "2026-05-21T09:00:00+00:00"}])
    with patch("services.task_calendar.get_supabase", return_value=db):
        result = task_calendar.due_reminders("user-1")

    assert result["tasks"][0]["id"] == "task-1"
