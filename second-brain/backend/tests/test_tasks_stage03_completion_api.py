from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.premium import PremiumStatus


def _chain(rows: list[dict]):
    chain = MagicMock()
    for method in ("select", "eq", "neq", "gte", "lte", "lt", "order", "range", "limit", "in_"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = rows
    return chain


def _update_chain(rows: list[dict]):
    chain = MagicMock()
    chain.update.return_value = chain
    for method in ("eq", "in_"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = rows
    return chain


def _delete_chain(rows: list[dict]):
    chain = MagicMock()
    chain.delete.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value.data = rows
    return chain


@pytest.mark.anyio
async def test_task_detail_and_archive(client):
    db = MagicMock()
    db.table.side_effect = [
        _chain([{"id": "task-1", "title": "Detail"}]),
        _update_chain([{"id": "task-1", "status": "archived"}]),
    ]
    with patch("api.tasks.get_supabase", return_value=db):
        detail = await client.get("/tasks/task-1")
        archived = await client.post("/tasks/task-1/archive")
    assert detail.status_code == 200
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"


@pytest.mark.anyio
async def test_bulk_update_validates_ownership_and_updates(client):
    db = MagicMock()
    db.table.side_effect = [
        _chain([{"id": "t1"}]),
        _chain([{"id": "t2"}]),
        _update_chain([{"id": "t1", "status": "active"}, {"id": "t2", "status": "active"}]),
    ]
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/bulk-update",
            json={"task_ids": ["t1", "t2"], "status": "active", "tags": ["deep"]},
        )
    assert resp.status_code == 200
    assert len(resp.json()["updated"]) == 2


@pytest.mark.anyio
async def test_checklist_full_crud(client):
    with (
        patch("api.tasks.task_relations.list_checklist", return_value=[{"id": "i1"}]),
        patch("api.tasks.task_relations.update_checklist_item", return_value={"id": "i1", "is_done": True}),
        patch("api.tasks.task_relations.delete_checklist_item", return_value=None),
        patch("api.tasks.task_relations.reorder_checklist", return_value={"items": [{"id": "i1", "position": 0}]}),
    ):
        listed = await client.get("/tasks/task-1/checklist")
        updated = await client.patch("/tasks/task-1/checklist/i1", json={"is_done": True})
        deleted = await client.delete("/tasks/task-1/checklist/i1")
        reordered = await client.post("/tasks/task-1/checklist/reorder", json={"item_ids": ["i1"]})
    assert listed.status_code == 200
    assert updated.json()["is_done"] is True
    assert deleted.status_code == 204
    assert reordered.json()["items"][0]["id"] == "i1"


@pytest.mark.anyio
async def test_dependencies_comments_attachments_routes(client):
    with (
        patch("api.tasks.task_relations.list_dependencies", return_value={"dependencies": []}),
        patch("api.tasks.task_relations.create_dependency", return_value={"id": "dep-1"}),
        patch("api.tasks.task_relations.delete_dependency", return_value=None),
        patch("api.tasks.task_relations.create_comment", return_value={"id": "c1", "body": "note"}),
        patch("api.tasks.task_relations.update_comment", return_value={"id": "c1", "body": "edited"}),
        patch("api.tasks.task_relations.delete_comment", return_value=None),
        patch("api.tasks.task_relations.create_attachment", return_value={"id": "a1", "kind": "link"}),
        patch("api.tasks.task_relations.update_attachment", return_value={"id": "a1", "title": "doc"}),
        patch("api.tasks.task_relations.delete_attachment", return_value=None),
    ):
        deps = await client.get("/tasks/task-1/dependencies")
        dep = await client.post("/tasks/task-1/dependencies", json={"depends_on_task_id": "task-2"})
        dep_del = await client.delete("/tasks/task-1/dependencies/dep-1")
        comment = await client.post("/tasks/task-1/comments", json={"body": "note"})
        comment_edit = await client.patch("/tasks/task-1/comments/c1", json={"body": "edited"})
        comment_del = await client.delete("/tasks/task-1/comments/c1")
        attach = await client.post("/tasks/task-1/attachments", json={"kind": "link", "url": "https://example.com"})
        attach_edit = await client.patch("/tasks/task-1/attachments/a1", json={"title": "doc"})
        attach_del = await client.delete("/tasks/task-1/attachments/a1")
    assert deps.status_code == 200
    assert dep.json()["id"] == "dep-1"
    assert dep_del.status_code == 204
    assert comment.json()["body"] == "note"
    assert comment_edit.json()["body"] == "edited"
    assert comment_del.status_code == 204
    assert attach.json()["kind"] == "link"
    assert attach_edit.json()["title"] == "doc"
    assert attach_del.status_code == 204


@pytest.mark.anyio
async def test_recurrence_habit_and_time_focus_routes(client):
    with (
        patch("api.tasks.task_recurrence.get_recurrence", return_value={"task_id": "task-1"}),
        patch("api.tasks.task_recurrence.put_recurrence", return_value={"id": "task-1", "habit_mode": True}),
        patch("api.tasks.task_recurrence.delete_recurrence", return_value=None),
        patch("api.tasks.task_recurrence.rollover_task", return_value={"id": "task-1", "rollover_count": 1}),
        patch("api.tasks.task_recurrence.rollover_due_recurring", return_value=[{"id": "task-1"}]),
        patch("api.tasks.task_recurrence.list_habits", return_value=[{"id": "task-1"}]),
        patch("api.tasks.task_recurrence.habit_stats", return_value={"task_id": "task-1", "focus_minutes": 25}),
        patch("api.tasks.task_planning.capacity", return_value={"overload": False}),
        patch("api.tasks.task_planning.free_slots", return_value={"slots": []}),
        patch("api.tasks.task_focus.summary", return_value={"focus_minutes": 25}),
        patch("api.tasks.task_focus.get_settings", return_value={"pomodoro_min": 25}),
        patch("api.tasks.task_focus.put_settings", return_value={"pomodoro_min": 30}),
    ):
        recurrence = await client.get("/tasks/task-1/recurrence")
        recurrence_put = await client.put("/tasks/task-1/recurrence", json={"frequency": "daily", "habit_mode": True})
        recurrence_del = await client.delete("/tasks/task-1/recurrence")
        rollover = await client.post("/tasks/task-1/rollover")
        run_due = await client.post("/tasks/recurrence/run-due")
        habits = await client.get("/tasks/habits")
        stats = await client.get("/tasks/habits/task-1/stats")
        capacity = await client.get("/tasks/time-blocks/capacity?target_date=2026-05-21")
        slots = await client.get("/tasks/time-blocks/free-slots?target_date=2026-05-21")
        focus = await client.get("/tasks/focus-summary")
        settings = await client.get("/tasks/focus-settings")
        settings_put = await client.put("/tasks/focus-settings", json={"pomodoro_min": 30})
    assert recurrence.json()["task_id"] == "task-1"
    assert recurrence_put.json()["habit_mode"] is True
    assert recurrence_del.status_code == 204
    assert rollover.json()["rollover_count"] == 1
    assert run_due.json()["tasks"][0]["id"] == "task-1"
    assert habits.json()[0]["id"] == "task-1"
    assert stats.json()["focus_minutes"] == 25
    assert capacity.json()["overload"] is False
    assert slots.json()["slots"] == []
    assert focus.json()["focus_minutes"] == 25
    assert settings.json()["pomodoro_min"] == 25
    assert settings_put.json()["pomodoro_min"] == 30


@pytest.mark.anyio
async def test_ai_endpoint_uses_budget_and_router(client):
    expected = {"action": "suggest", "result": {"priority": 3}, "tokens_used": 7, "tier": "cheap"}
    with (
        patch("api.tasks.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=True))),
        patch("api.tasks.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.tasks.ai_budget.record_usage", new=AsyncMock(return_value=None)) as record,
        patch("api.tasks.task_ai_planning.run", new=AsyncMock(return_value=expected)) as run,
    ):
        resp = await client.post("/tasks/ai/suggest", json={"text": "plan this"})
    assert resp.status_code == 200
    assert resp.json()["result"]["priority"] == 3
    assert run.await_args.args[0] == "suggest"
    record.assert_awaited_once()


@pytest.mark.anyio
async def test_ai_endpoint_returns_429_when_budget_exceeded(client):
    with (
        patch("api.tasks.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=False))),
        patch("api.tasks.ai_budget.has_budget", new=AsyncMock(return_value=False)),
    ):
        resp = await client.post("/tasks/ai/split", json={"text": "split this"})
    assert resp.status_code == 429


@pytest.mark.anyio
async def test_capture_integration_contract(client):
    expected = {"tasks": [{"id": "task-1", "parser_metadata": {}}], "tokens_used": 3}
    with (
        patch("api.tasks.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=True))),
        patch("api.tasks.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.tasks.ai_budget.record_usage", new=AsyncMock(return_value=None)),
        patch("api.tasks.task_capture.capture_text", new=AsyncMock(return_value=expected)) as capture,
    ):
        resp = await client.post(
            "/tasks/capture/browser",
            json={"text": "save page", "external_id": "url-1", "metadata": {"url": "https://example.com"}},
        )
    assert resp.status_code == 201
    assert capture.await_args.kwargs["source"].value == "browser"
    assert resp.json()["tasks"][0]["parser_metadata"]["external_id"] == "url-1"
