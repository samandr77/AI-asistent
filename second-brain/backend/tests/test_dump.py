from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from models.task import ParsedDump, ParsedTask, Sphere, Priority
from models.premium import PremiumStatus

MOCK_PARSED = ParsedDump(tasks=[
    ParsedTask(title="Купить молоко", sphere=Sphere.family, priority=Priority.high, is_today=True),
    ParsedTask(title="Сдать отчёт", sphere=Sphere.work, priority=Priority.medium, is_today=True),
    ParsedTask(title="Прочитать книгу", sphere=Sphere.study, priority=Priority.low, is_today=False),
])

@pytest.mark.anyio
async def test_dump_text_returns_tasks(client):
    with (
        patch("api.dump.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=True))),
        patch("api.dump.parse_dump", new=AsyncMock(return_value=MOCK_PARSED)),
        patch("api.dump.save_tasks", new=AsyncMock(return_value=("dump-id-123", ["t1","t2","t3"]))),
    ):
        resp = await client.post("/dump/text", json={"text": "купить молоко и сдать отчёт"})
    assert resp.status_code == 200
    body = resp.json()
    assert "tasks" in body
    assert "today_top3" in body
    assert len(body["tasks"]) == 3
    assert len(body["today_top3"]) <= 3

@pytest.mark.anyio
async def test_dump_text_empty_returns_422(client):
    resp = await client.post("/dump/text", json={"text": ""})
    assert resp.status_code == 422

@pytest.mark.anyio
async def test_dump_text_no_auth_returns_401():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post("/dump/text", json={"text": "test"})
    assert resp.status_code == 401
