from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER = "okr-user-0001"

GOAL_ROW = {
    "id": "goal-okr-0001",
    "user_id": TEST_USER,
    "title": "Запустить SaaS",
    "description": None,
    "target_date": None,
    "status": "active",
    "sphere": "work",
    "progress_percent": 0,
    "level": "year",
    "parent_goal_id": None,
    "horizon_start": None,
    "horizon_end": None,
    "weight": 1,
    "created_at": "2026-04-24T00:00:00+00:00",
    "updated_at": "2026-04-24T00:00:00+00:00",
}

KR_ROW = {
    "id": "kr-0001",
    "goal_id": GOAL_ROW["id"],
    "user_id": TEST_USER,
    "title": "MRR $5k",
    "metric": "mrr_usd",
    "unit": "USD",
    "start_value": 0,
    "target_value": 5000,
    "current_value": 1500,
    "direction": "increase",
    "status": "on_track",
    "due_date": None,
    "created_at": "2026-04-24T00:00:00+00:00",
    "updated_at": "2026-04-24T00:00:00+00:00",
}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    from main import app
    import auth

    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _terminal(data):
    t = MagicMock()
    t.execute.return_value.data = data
    return t


@pytest.mark.anyio
async def test_create_goal_with_level_and_parent(client):
    payload = {
        "title": "Q2 запуск MVP",
        "level": "quarter",
        "parent_goal_id": GOAL_ROW["id"],
    }
    with patch("api.goals.get_supabase") as mock_db, patch(
        "api.goals._enforce_goal_limit"
    ):
        parent_chain = MagicMock()
        parent_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": GOAL_ROW["id"]}
        ]
        insert_chain = MagicMock()
        insert_chain.insert.return_value.execute.return_value.data = [
            {**GOAL_ROW, "level": "quarter", "parent_goal_id": GOAL_ROW["id"]}
        ]
        mock_db.return_value.table.side_effect = [parent_chain, insert_chain]
        resp = await client.post("/goals/", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["level"] == "quarter"
    assert body["parent_goal_id"] == GOAL_ROW["id"]


@pytest.mark.anyio
async def test_create_goal_invalid_level_returns_422(client):
    with patch("api.goals._enforce_goal_limit"):
        resp = await client.post(
            "/goals/", json={"title": "bad", "level": "decade"}
        )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_kr_success(client):
    with patch("api.goals.get_supabase") as mock_db:
        goal_chain = MagicMock()
        goal_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": GOAL_ROW["id"]}
        ]
        insert_chain = MagicMock()
        insert_chain.insert.return_value.execute.return_value.data = [KR_ROW]
        mock_db.return_value.table.side_effect = [goal_chain, insert_chain]
        resp = await client.post(
            f"/goals/{GOAL_ROW['id']}/key-results",
            json={"title": "MRR $5k", "target_value": 5000, "current_value": 1500},
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["progress_percent"] == 30  # 1500/5000
    assert body["status"] in {"at_risk", "on_track"}


@pytest.mark.anyio
async def test_list_krs_enriches_progress(client):
    with patch("api.goals.get_supabase") as mock_db:
        goal_chain = MagicMock()
        goal_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": GOAL_ROW["id"]}
        ]
        list_chain = MagicMock()
        list_chain.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            KR_ROW
        ]
        mock_db.return_value.table.side_effect = [goal_chain, list_chain]
        resp = await client.get(f"/goals/{GOAL_ROW['id']}/key-results")
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["progress_percent"] == 30
