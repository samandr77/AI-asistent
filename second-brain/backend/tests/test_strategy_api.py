from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER = "strategy-user-0001"


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


@pytest.mark.anyio
async def test_get_strategy_returns_defaults_when_empty(client):
    with patch("api.strategy.get_supabase") as mock_db:
        chain = MagicMock()
        chain.select.return_value.eq.return_value.execute.return_value.data = []
        mock_db.return_value.table.return_value = chain
        resp = await client.get("/strategy/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mission"] is None
    assert body["values"] == []
    assert body["swot_strengths"] == []


@pytest.mark.anyio
async def test_put_strategy_creates_when_missing(client):
    with patch("api.strategy.get_supabase") as mock_db:
        existing_chain = MagicMock()
        existing_chain.select.return_value.eq.return_value.execute.return_value.data = []
        insert_chain = MagicMock()
        insert_chain.insert.return_value.execute.return_value.data = [
            {
                "user_id": TEST_USER,
                "mission": "Жить осмысленно",
                "vision": None,
                "values": ["Семья", "Здоровье"],
                "life_areas": [],
                "swot_strengths": [],
                "swot_weaknesses": [],
                "swot_opportunities": [],
                "swot_threats": [],
            }
        ]
        mock_db.return_value.table.side_effect = [existing_chain, insert_chain]
        resp = await client.put(
            "/strategy/",
            json={"mission": "Жить осмысленно", "values": ["Семья", "Здоровье"]},
        )
    assert resp.status_code == 200
    assert resp.json()["mission"] == "Жить осмысленно"
    assert resp.json()["values"] == ["Семья", "Здоровье"]


@pytest.mark.anyio
async def test_put_strategy_rejects_oversize_list(client):
    resp = await client.put("/strategy/", json={"values": ["x"] * 31})
    assert resp.status_code == 422
