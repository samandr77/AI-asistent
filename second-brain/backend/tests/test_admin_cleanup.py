from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


ADMIN_SECRET = "test-admin-cleanup-secret"  # matches conftest default


def _supabase_with_lock(lock_taken: bool = True, due_rows: list[dict] | None = None):
    db = MagicMock()
    # pg_try_advisory_lock / pg_advisory_unlock
    lock_call = db.rpc.return_value.execute
    lock_call.return_value.data = lock_taken

    # user_profiles.select chain for purge_due_users
    rows = due_rows if due_rows is not None else []
    chain = db.table.return_value
    select = chain.select.return_value
    not_call = select.not_
    not_call.is_.return_value.lt.return_value.execute.return_value.data = rows

    # cascade_delete_user RPC — treated as success
    db.auth.admin.delete_user = MagicMock()
    return db


@pytest.fixture
async def client_no_auth_override():
    """Client that does NOT override auth — admin endpoint uses a secret, not user JWT."""
    from httpx import AsyncClient, ASGITransport

    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_cleanup_requires_bearer(client_no_auth_override):
    resp = await client_no_auth_override.post("/admin/cleanup-deleted")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_cleanup_rejects_wrong_bearer(client_no_auth_override):
    resp = await client_no_auth_override.post(
        "/admin/cleanup-deleted",
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_cleanup_empty_run_returns_200(client_no_auth_override):
    db = _supabase_with_lock(lock_taken=True, due_rows=[])
    with patch("api.admin.get_supabase", return_value=db):
        resp = await client_no_auth_override.post(
            "/admin/cleanup-deleted",
            headers={"Authorization": f"Bearer {ADMIN_SECRET}"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["processed"] == 0
    assert body["deleted_users"] == []
    assert body["errors"] == []


@pytest.mark.anyio
async def test_cleanup_processes_due_user(client_no_auth_override):
    uid = "11111111-1111-1111-1111-111111111111"
    db = _supabase_with_lock(
        lock_taken=True,
        due_rows=[{"id": uid, "deleted_at": "2000-01-01T00:00:00+00:00"}],
    )
    with patch("api.admin.get_supabase", return_value=db):
        resp = await client_no_auth_override.post(
            "/admin/cleanup-deleted",
            headers={"Authorization": f"Bearer {ADMIN_SECRET}"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["processed"] == 1
    assert body["deleted_users"] == [uid]
    # Called cascade_delete_user RPC + auth delete
    calls = [c.args[0] for c in db.rpc.call_args_list]
    assert "cascade_delete_user" in calls
    db.auth.admin.delete_user.assert_called_once_with(uid)


@pytest.mark.anyio
async def test_cleanup_returns_409_when_lock_held(client_no_auth_override):
    db = _supabase_with_lock(lock_taken=False, due_rows=[])
    with patch("api.admin.get_supabase", return_value=db):
        resp = await client_no_auth_override.post(
            "/admin/cleanup-deleted",
            headers={"Authorization": f"Bearer {ADMIN_SECRET}"},
        )
    assert resp.status_code == 409
