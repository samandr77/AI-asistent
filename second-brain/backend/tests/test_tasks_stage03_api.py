from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from models.premium import PremiumStatus


@pytest.mark.anyio
async def test_capture_endpoint_uses_parser_v2_service(client):
    expected = {
        "dump_id": "dump-1",
        "tasks": [{"id": "task-1", "title": "Позвонить Маше", "status": "inbox"}],
        "today_top3": [],
        "task_ids": ["task-1"],
        "used_fallback": False,
        "tokens_used": 42,
    }
    with (
        patch("api.tasks.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=True))),
        patch("api.tasks.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.tasks.ai_budget.record_usage", new=AsyncMock(return_value=None)),
        patch("api.tasks.task_capture.capture_text", new=AsyncMock(return_value=expected)) as capture,
    ):
        resp = await client.post(
            "/tasks/capture",
            json={"text": "позвонить Маше завтра в 15:00", "source": "telegram"},
        )

    assert resp.status_code == 201
    assert resp.json()["tasks"][0]["status"] == "inbox"
    assert capture.await_args.args[0] == "позвонить Маше завтра в 15:00"
    assert capture.await_args.kwargs["source"].value == "telegram"


@pytest.mark.anyio
async def test_matrix_endpoint_returns_four_quadrants(client):
    matrix = {"do_now": [], "schedule": [], "delegate": [], "delete": []}
    with patch("api.tasks.task_planning.get_matrix", return_value=matrix):
        resp = await client.get("/tasks/matrix")

    assert resp.status_code == 200
    assert resp.json() == matrix


@pytest.mark.anyio
async def test_big_three_rejects_more_than_three(client):
    resp = await client.post(
        "/tasks/big-three",
        json={"date": "2026-05-20", "task_ids": ["t1", "t2", "t3", "t4"]},
    )

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_time_block_endpoint_updates_task(client):
    expected = {"id": "task-1", "scheduled_start": "2026-05-20T09:00:00+00:00"}
    with patch("api.tasks.task_planning.create_time_block", return_value=expected) as create:
        resp = await client.post(
            "/tasks/time-blocks",
            json={
                "task_id": "task-1",
                "scheduled_start": "2026-05-20T09:00:00+00:00",
                "scheduled_end": "2026-05-20T10:00:00+00:00",
                "deep_work": True,
            },
        )

    assert resp.status_code == 201
    assert resp.json()["id"] == "task-1"
    assert create.call_args.args[1].deep_work is True


@pytest.mark.anyio
async def test_focus_session_defaults_to_pomodoro_duration(client):
    db = MagicMock()
    task_chain = MagicMock()
    task_chain.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "task-1", "duration_actual_min": 0}
    ]
    focus_chain = MagicMock()
    focus_chain.insert.return_value.execute.return_value.data = [
        {"id": "focus-1", "task_id": "task-1", "duration_min": 25}
    ]
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"id": "task-1", "duration_actual_min": 25}
    ]
    db.table.side_effect = [task_chain, focus_chain, task_chain, update_chain]

    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/task-1/focus-sessions",
            json={"started_at": datetime.now(timezone.utc).isoformat()},
        )

    assert resp.status_code == 201
    inserted = focus_chain.insert.call_args.args[0]
    assert inserted["duration_min"] == 25


@pytest.mark.anyio
async def test_checklist_endpoint_creates_item(client):
    with patch(
        "api.tasks.task_projects.add_checklist_item",
        return_value={"id": "item-1", "title": "Первый шаг"},
    ):
        resp = await client.post("/tasks/task-1/checklist", json={"title": "Первый шаг"})

    assert resp.status_code == 201
    assert resp.json()["title"] == "Первый шаг"


@pytest.mark.anyio
async def test_analytics_endpoint_returns_summary(client):
    summary = {"tasks_total": 3, "completed_count": 2, "focus_minutes": 50}
    with patch("api.tasks.task_analytics.analytics", return_value=summary):
        resp = await client.get("/tasks/analytics")

    assert resp.status_code == 200
    assert resp.json()["completed_count"] == 2
