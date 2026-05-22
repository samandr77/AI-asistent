from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER = "review-user-0001"


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
async def test_weekly_draft_returns_summary(client):
    completed = [
        {
            "id": "t1",
            "title": "Done thing",
            "sphere": "work",
            "priority": 1,
            "is_done": True,
        }
    ]
    carried = []
    goals = [
        {
            "id": "g1",
            "user_id": TEST_USER,
            "title": "OKR",
            "status": "active",
            "progress_percent": 30,
            "level": "quarter",
        }
    ]

    with patch("api.reviews.get_supabase") as mock_db:
        completed_chain = MagicMock()
        (
            completed_chain.select.return_value.eq.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data
        ) = completed
        carried_chain = MagicMock()
        (
            carried_chain.select.return_value.eq.return_value.eq.return_value.lte.return_value.execute.return_value.data
        ) = carried
        goals_chain = MagicMock()
        (
            goals_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data
        ) = goals
        kr_chain = MagicMock()
        kr_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        tasks_chain = MagicMock()
        tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        mock_db.return_value.table.side_effect = [
            completed_chain,
            carried_chain,
            goals_chain,
            kr_chain,
            tasks_chain,
        ]
        resp = await client.get("/reviews/weekly/draft?week=2026-05-21")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed_tasks_count"] == 1
    assert body["active_goals"] == 1
    assert body["okr_progress"][0]["title"] == "OKR"
    assert len(body["suggestions"]) >= 1


@pytest.mark.anyio
async def test_current_week_alias_does_not_raise_invalid_week(client):
    with patch("api.reviews.get_supabase") as mock_db:
        query = mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value
        query.execute.return_value.data = []

        resp = await client.get("/reviews/weekly/current")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Weekly review not found"
