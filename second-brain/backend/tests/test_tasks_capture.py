"""Phase 1 tests: quick capture, inbox listing, process actions, status invariant."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest



def _insert_chain(returned_row: dict | None):
    chain = MagicMock()
    chain.insert.return_value = chain
    chain.execute.return_value.data = [returned_row] if returned_row else []
    return chain


def _select_chain(rows: list[dict]):
    chain = MagicMock()
    for method in ("select", "eq", "gte", "order", "range", "limit"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = rows
    return chain


def _update_chain(returned_row: dict | None):
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value.data = [returned_row] if returned_row else []
    return chain


def _delete_chain(returned_row: dict | None):
    chain = MagicMock()
    chain.delete.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value.data = [returned_row] if returned_row else []
    return chain


# ── T009: POST /tasks ──


@pytest.mark.anyio
async def test_create_minimal(client, test_user_id):
    db = MagicMock()
    inserted = {
        "id": "task-new",
        "user_id": test_user_id,
        "title": "купить хлеб",
        "status": "active",
        "is_done": False,
        "is_today": False,
        "priority": 2,
    }
    db.table.return_value = _insert_chain(inserted)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post("/tasks/", json={"title": "купить хлеб"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "купить хлеб"
    assert body["status"] == "active"


@pytest.mark.anyio
async def test_create_full_payload(client, test_user_id):
    db = MagicMock()
    inserted = {
        "id": "task-full",
        "user_id": test_user_id,
        "title": "позвонить Маше",
        "status": "inbox",
        "raw_text": "позвонить Маше завтра в 15:00",
        "is_done": False,
        "is_today": False,
        "priority": 3,
        "sphere": "work",
    }
    db.table.return_value = _insert_chain(inserted)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/",
            json={
                "title": "позвонить Маше",
                "raw_text": "позвонить Маше завтра в 15:00",
                "status": "inbox",
                "priority": 3,
                "sphere": "work",
            },
        )
    assert resp.status_code == 201
    assert resp.json()["status"] == "inbox"
    assert resp.json()["raw_text"] == "позвонить Маше завтра в 15:00"


@pytest.mark.anyio
async def test_create_validation_422(client):
    resp = await client.post("/tasks/", json={"title": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_quick_add_defaults_to_active(client, test_user_id):
    db = MagicMock()
    captured = {}

    def insert_capture(payload):
        captured.update(payload)
        chain = MagicMock()
        chain.execute.return_value.data = [{**payload, "id": "x"}]
        return chain

    table = MagicMock()
    table.insert.side_effect = insert_capture
    db.table.return_value = table
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post("/tasks/", json={"title": "тест"})
    assert resp.status_code == 201
    assert captured["status"] == "active"


# ── T008: status ⟺ is_done invariant ──


@pytest.mark.anyio
async def test_status_done_invariant_via_is_done(client, test_user_id):
    db = MagicMock()
    captured = {}

    def update_capture(payload):
        captured.update(payload)
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.execute.return_value.data = [{"id": "t1", **payload}]
        return chain

    table = MagicMock()
    table.update.side_effect = update_capture
    db.table.return_value = table
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.patch("/tasks/t1", json={"is_done": True})
    assert resp.status_code == 200
    assert captured["is_done"] is True
    assert captured["status"] == "done"


@pytest.mark.anyio
async def test_status_done_invariant_via_status(client, test_user_id):
    db = MagicMock()
    captured = {}

    def update_capture(payload):
        captured.update(payload)
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.execute.return_value.data = [{"id": "t1", **payload}]
        return chain

    table = MagicMock()
    table.update.side_effect = update_capture
    db.table.return_value = table
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.patch("/tasks/t1", json={"status": "done"})
    assert resp.status_code == 200
    assert captured["status"] == "done"
    assert captured["is_done"] is True


# ── T015: GET /tasks/inbox ──


@pytest.mark.anyio
async def test_get_inbox_empty(client):
    db = MagicMock()
    db.table.return_value = _select_chain([])
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.get("/tasks/inbox")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_get_inbox_only_inbox_status(client):
    db = MagicMock()
    rows = [
        {"id": "t1", "title": "первая", "status": "inbox"},
        {"id": "t2", "title": "вторая", "status": "inbox"},
    ]
    chain = _select_chain(rows)
    db.table.return_value = chain
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.get("/tasks/inbox")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    # Verify the inbox status filter was applied
    chain.eq.assert_any_call("status", "inbox")


# ── T015: POST /tasks/{id}/process ──


def _process_setup(stored: dict):
    """Build a db mock where select returns stored task, update mutates a captured dict."""
    db = MagicMock()
    captured = {"updates": None}

    table = MagicMock()
    # select chain
    select_chain = MagicMock()
    for m in ("select", "eq", "order", "range", "limit"):
        getattr(select_chain, m).return_value = select_chain
    select_chain.execute.return_value.data = [stored]
    table.select.return_value = select_chain

    # update chain
    def update_call(payload):
        captured["updates"] = payload
        upd = MagicMock()
        upd.eq.return_value = upd
        upd.execute.return_value.data = [{**stored, **payload}]
        return upd

    table.update.side_effect = update_call

    # delete chain
    del_chain = MagicMock()
    del_chain.eq.return_value = del_chain
    del_chain.execute.return_value.data = [stored]
    table.delete.return_value = del_chain

    db.table.return_value = table
    return db, captured


@pytest.mark.anyio
async def test_process_schedule_today(client):
    stored = {"id": "t1", "status": "inbox", "is_done": False, "notes": None}
    db, captured = _process_setup(stored)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/t1/process", json={"action": "schedule", "is_today": True}
        )
    assert resp.status_code == 200
    assert resp.json()["already_processed"] is False
    assert captured["updates"]["status"] == "active"
    assert captured["updates"]["is_today"] is True


@pytest.mark.anyio
async def test_process_delegate_with_notes(client):
    stored = {"id": "t2", "status": "inbox", "is_done": False, "notes": "пометка"}
    db, captured = _process_setup(stored)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/t2/process",
            json={"action": "delegate", "delegate_to": "Иван"},
        )
    assert resp.status_code == 200
    assert captured["updates"]["status"] == "delegated"
    assert "[delegated to Иван]" in captured["updates"]["notes"]


@pytest.mark.anyio
async def test_process_delete_returns_204(client):
    stored = {"id": "t3", "status": "inbox", "is_done": False, "notes": None}
    db, _ = _process_setup(stored)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post("/tasks/t3/process", json={"action": "delete"})
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_process_convert_project_tag(client):
    stored = {"id": "t4", "status": "inbox", "is_done": False, "notes": None}
    db, captured = _process_setup(stored)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/t4/process", json={"action": "convert_project"}
        )
    assert resp.status_code == 200
    assert captured["updates"]["status"] == "active"
    assert "[project candidate]" in captured["updates"]["notes"]


@pytest.mark.anyio
async def test_process_idempotent_second_call(client):
    stored = {"id": "t5", "status": "active", "is_done": False, "notes": None}
    db, _ = _process_setup(stored)
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/t5/process", json={"action": "schedule", "is_today": True}
        )
    assert resp.status_code == 200
    assert resp.json()["already_processed"] is True


@pytest.mark.anyio
async def test_process_404_when_not_found(client):
    db = MagicMock()
    table = MagicMock()
    select_chain = MagicMock()
    for m in ("select", "eq", "limit"):
        getattr(select_chain, m).return_value = select_chain
    select_chain.execute.return_value.data = []
    table.select.return_value = select_chain
    db.table.return_value = table
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.post(
            "/tasks/ghost/process", json={"action": "schedule"}
        )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_process_invalid_action_422(client):
    resp = await client.post("/tasks/t1/process", json={"action": "explode"})
    assert resp.status_code == 422
