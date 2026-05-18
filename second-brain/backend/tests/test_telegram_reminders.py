from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.telegram import TelegramReminderSendReport
from services.reminder_scheduler import send_due_reflection_reminders


ADMIN_SECRET = "test-admin-cleanup-secret"
TEST_USER_ID = "00000000-0000-4000-8000-000000000101"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def authed_client():
    from httpx import ASGITransport, AsyncClient

    import auth
    from main import app

    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_ID
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_reminder_settings_returns_defaults(authed_client):
    with patch("api.telegram_reminders.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        resp = await authed_client.get("/telegram/reminders/settings")

    assert resp.status_code == 200
    body = resp.json()
    assert body["daily_reflection_enabled"] is True
    assert body["daily_reflection_time"] == "21:00"
    assert body["morning_enabled"] is False


@pytest.mark.anyio
async def test_put_reminder_settings_saves_for_linked_telegram_account(authed_client):
    saved_row = {
        "user_id": TEST_USER_ID,
        "telegram_user_id": 1001,
        "daily_reflection_enabled": True,
        "daily_reflection_time": "20:30",
        "morning_enabled": True,
        "morning_time": "08:15",
        "timezone": "Europe/Minsk",
    }

    with patch("api.telegram_reminders.get_supabase") as mock_db:
        db = mock_db.return_value
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"telegram_user_id": 1001}
        ]
        db.table.return_value.upsert.return_value.execute.return_value.data = [saved_row]

        resp = await authed_client.put(
            "/telegram/reminders/settings",
            json={
                "daily_reflection_enabled": True,
                "daily_reflection_time": "20:30",
                "morning_enabled": True,
                "morning_time": "08:15",
                "timezone": "Europe/Minsk",
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["daily_reflection_time"] == "20:30"
    assert body["morning_time"] == "08:15"
    db.table.return_value.upsert.assert_called_once()
    payload = db.table.return_value.upsert.call_args.args[0]
    assert payload["user_id"] == TEST_USER_ID
    assert payload["telegram_user_id"] == 1001


@pytest.mark.anyio
async def test_put_reminder_settings_requires_telegram_account(authed_client):
    with patch("api.telegram_reminders.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        resp = await authed_client.put(
            "/telegram/reminders/settings",
            json={"daily_reflection_time": "20:30"},
        )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Telegram account not found"


@pytest.mark.anyio
async def test_send_due_reminders_requires_admin_bearer(authed_client):
    resp = await authed_client.post("/telegram/reminders/send-due")
    assert resp.status_code == 401

    resp = await authed_client.post(
        "/telegram/reminders/send-due",
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_send_due_reminders_endpoint_runs_scheduler_with_admin_bearer(authed_client):
    report = TelegramReminderSendReport(
        processed=1,
        sent=1,
        skipped=0,
        errors=[],
        ran_at=datetime(2026, 5, 2, 21, 0, tzinfo=timezone.utc),
    )
    with (
        patch("api.telegram_reminders.get_supabase", return_value=MagicMock()),
        patch(
            "api.telegram_reminders.send_due_reflection_reminders",
            new=AsyncMock(return_value=report),
        ) as mock_send,
    ):
        resp = await authed_client.post(
            "/telegram/reminders/send-due",
            headers={"Authorization": f"Bearer {ADMIN_SECRET}"},
        )

    assert resp.status_code == 200
    assert resp.json()["sent"] == 1
    mock_send.assert_awaited_once()


@pytest.mark.anyio
async def test_send_due_reflection_reminders_sends_once_and_marks_date():
    current = datetime(2026, 5, 2, 21, 0, tzinfo=timezone.utc)
    rows = [
        {
            "user_id": "00000000-0000-4000-8000-000000000201",
            "telegram_user_id": 1001,
            "daily_reflection_enabled": True,
            "daily_reflection_time": "21:00",
            "last_daily_reflection_sent_for": None,
        },
        {
            "user_id": "00000000-0000-4000-8000-000000000202",
            "telegram_user_id": 1002,
            "daily_reflection_enabled": True,
            "daily_reflection_time": "21:00",
            "last_daily_reflection_sent_for": "2026-05-02",
        },
    ]
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = rows
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{}]
    bot = MagicMock()
    bot.send_message = AsyncMock(return_value={"message_id": 10})

    report = await send_due_reflection_reminders(db, bot=bot, now=current)

    assert report.processed == 1
    assert report.sent == 1
    assert report.skipped == 0
    bot.send_message.assert_awaited_once()
    assert bot.send_message.await_args.args[0] == 1001
    db.table.return_value.update.assert_called_once_with(
        {"last_daily_reflection_sent_for": "2026-05-02"}
    )
