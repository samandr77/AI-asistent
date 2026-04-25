import pytest
from unittest.mock import patch, MagicMock

from models.premium import PremiumStatus


def _fluent_chain(return_data):
    chain = MagicMock()
    for method in ("select", "eq", "gte", "order", "range", "limit"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = return_data
    return chain


@pytest.mark.anyio
async def test_get_today_tasks_returns_list(client):
    mock_data = [
        {"id": "t1", "title": "Купить молоко", "sphere": "family", "priority": 3, "is_today": True, "is_done": False},
        {"id": "t2", "title": "Сдать отчёт", "sphere": "work", "priority": 2, "is_today": True, "is_done": False},
    ]
    chain = _fluent_chain(mock_data)
    with patch("api.tasks.get_supabase") as mock_db, patch(
        "api.tasks.get_user_premium", return_value=PremiumStatus(is_premium=True)
    ):
        mock_db.return_value.table.return_value = chain
        resp = await client.get("/tasks/today")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

@pytest.mark.anyio
async def test_patch_task_updates_fields(client):
    mock_data = [{"id": "t1", "title": "Обновлено", "is_done": True}]
    with patch("api.tasks.get_supabase") as mock_db:
        chain = mock_db.return_value.table.return_value
        chain.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = mock_data
        resp = await client.patch("/tasks/t1", json={"is_done": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Обновлено"
    assert body["is_done"] is True
