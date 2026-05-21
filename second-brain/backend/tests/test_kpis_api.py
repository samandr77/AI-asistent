from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER = "kpi-user-0001"

KPI_ROW = {
    "id": "kpi-0001",
    "user_id": TEST_USER,
    "name": "Шаги в день",
    "unit": "шагов",
    "sphere": "health",
    "target_value": 10000,
    "current_value": 8000,
    "direction": "increase",
    "warning_threshold": 5000,
    "is_active": True,
    "created_at": "2026-05-01T00:00:00+00:00",
    "updated_at": "2026-05-01T00:00:00+00:00",
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


@pytest.mark.anyio
async def test_list_kpis_enriched_with_status(client):
    with patch("api.kpis.get_supabase") as mock_db:
        list_chain = MagicMock()
        list_chain.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            KPI_ROW
        ]
        history_chain = MagicMock()
        history_chain.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {"value": 6000},
            {"value": 8000},
        ]
        mock_db.return_value.table.side_effect = [list_chain, history_chain]
        resp = await client.get("/kpis/")
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["status"] == "warning"
    assert body[0]["trend_percent"] is not None


@pytest.mark.anyio
async def test_create_kpi_success(client):
    payload = {
        "name": "Шаги в день",
        "target_value": 10000,
        "current_value": 8000,
        "warning_threshold": 5000,
    }
    with patch("api.kpis.get_supabase") as mock_db:
        count_chain = MagicMock()
        count_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.count = 0
        insert_chain = MagicMock()
        insert_chain.insert.return_value.execute.return_value.data = [KPI_ROW]
        mock_db.return_value.table.side_effect = [count_chain, insert_chain]
        resp = await client.post("/kpis/", json=payload)
    assert resp.status_code == 201
    assert resp.json()["status"] == "warning"


@pytest.mark.anyio
async def test_create_kpi_blocks_over_20(client):
    with patch("api.kpis.get_supabase") as mock_db:
        count_chain = MagicMock()
        count_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.count = 20
        mock_db.return_value.table.return_value = count_chain
        resp = await client.post("/kpis/", json={"name": "Лимит"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_add_history_entry_bumps_current_value(client):
    with patch("api.kpis.get_supabase") as mock_db:
        own_chain = MagicMock()
        own_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": KPI_ROW["id"]}
        ]
        insert_chain = MagicMock()
        insert_chain.insert.return_value.execute.return_value.data = [
            {
                "id": "hist-1",
                "kpi_id": KPI_ROW["id"],
                "user_id": TEST_USER,
                "recorded_on": "2026-05-21",
                "value": 9500,
                "note": None,
                "created_at": "2026-05-21T00:00:00+00:00",
            }
        ]
        update_chain = MagicMock()
        update_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        mock_db.return_value.table.side_effect = [own_chain, insert_chain, update_chain]
        resp = await client.post(
            f"/kpis/{KPI_ROW['id']}/history",
            json={"value": 9500, "recorded_on": "2026-05-21"},
        )
    assert resp.status_code == 201
    assert resp.json()["value"] == 9500
