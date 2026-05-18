from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


TEST_USER_ID = "account-deletion-user-9999"


def _supabase_stub(profile_row: dict | None, update_returns: dict | None = None):
    """Return a MagicMock that mimics supabase-py chain for user_profiles."""
    table = MagicMock()
    table.select.return_value.eq.return_value.execute.return_value.data = (
        [profile_row] if profile_row else []
    )
    update_chain = table.update.return_value.eq.return_value.execute
    update_chain.return_value.data = (
        [update_returns] if update_returns else [profile_row] if profile_row else []
    )

    db = MagicMock()
    db.table.return_value = table
    db.auth.admin.sign_out = MagicMock()
    db.auth.admin.delete_user = MagicMock()
    return db


@pytest.fixture
async def authed_client():
    """Client with the auth dependency overridden — simulates a logged-in user."""
    from httpx import AsyncClient, ASGITransport

    import auth as auth_module
    from main import app

    app.dependency_overrides[auth_module.get_current_user_id] = lambda: TEST_USER_ID
    app.dependency_overrides[auth_module.get_current_user] = lambda: auth_module.CurrentUser(
        id=TEST_USER_ID, provider="apple"
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_delete_account_happy_path(authed_client):
    db = _supabase_stub({"id": TEST_USER_ID, "deleted_at": None})
    with patch("api.auth.get_supabase", return_value=db):
        resp = await authed_client.delete("/auth/account")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "scheduled"
    # scheduled_for ≈ now + 30 days
    scheduled = datetime.fromisoformat(body["scheduled_for"].replace("Z", "+00:00"))
    delta = scheduled - datetime.now(timezone.utc)
    assert timedelta(days=29, hours=23) < delta <= timedelta(days=30, minutes=5)
    # soft-delete update was issued
    db.table.return_value.update.assert_called_once()


@pytest.mark.anyio
async def test_delete_account_already_deleted_returns_409(authed_client):
    existing_ts = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    db = _supabase_stub({"id": TEST_USER_ID, "deleted_at": existing_ts})
    with patch("api.auth.get_supabase", return_value=db):
        resp = await authed_client.delete("/auth/account")

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["error"] == "account_already_deleted"
    assert "scheduled_for" in detail


@pytest.mark.anyio
async def test_delete_account_unauthenticated_returns_401():
    from httpx import AsyncClient, ASGITransport
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.delete("/auth/account")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_me_returns_410_when_soft_deleted(authed_client):
    existing_ts = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    db = _supabase_stub({"id": TEST_USER_ID, "deleted_at": existing_ts})
    with patch("api.auth.get_supabase", return_value=db):
        resp = await authed_client.get("/auth/me")
    assert resp.status_code == 410
    body = resp.json()
    assert body["error"] == "account_pending_deletion"
    assert "scheduled_for" in body


@pytest.mark.anyio
async def test_me_returns_200_when_not_deleted(authed_client):
    db = _supabase_stub({"id": TEST_USER_ID, "deleted_at": None})
    with patch("api.auth.get_supabase", return_value=db):
        resp = await authed_client.get("/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == TEST_USER_ID
    assert body["profile"]["id"] == TEST_USER_ID


@pytest.mark.anyio
async def test_delete_account_profile_not_found(authed_client):
    db = _supabase_stub(None)
    with patch("api.auth.get_supabase", return_value=db):
        resp = await authed_client.delete("/auth/account")
    assert resp.status_code == 404


def test_cascade_delete_user_rpc_covers_telegram_tables():
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "012_telegram_reminders.sql"
    )
    sql = migration.read_text()
    assert "delete from public.telegram_reminder_settings" in sql
    assert "delete from public.telegram_accounts" in sql
