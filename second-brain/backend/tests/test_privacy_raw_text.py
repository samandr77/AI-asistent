"""Phase 1: privacy guarantees for raw_text.

raw_text and source_text must not leak into:
- Sentry payloads
- stdout/structured logs

Plus: deleting a task removes raw_text from storage.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest

from main import _sentry_before_send, _redact_raw_text


def test_redact_raw_text_in_dict():
    event = {
        "request": {
            "data": {
                "title": "test",
                "raw_text": "секретный текст",
            },
        }
    }
    result = _sentry_before_send(event, None)
    assert result["request"]["data"]["title"] == "test"
    assert result["request"]["data"]["raw_text"] == "<redacted>"


def test_redact_source_text():
    event = {
        "extra": {
            "tasks": [
                {"title": "x", "source_text": "оригинал"},
                {"title": "y", "source_text": "ещё"},
            ]
        }
    }
    result = _sentry_before_send(event, None)
    for task in result["extra"]["tasks"]:
        assert task["source_text"] == "<redacted>"


def test_redact_nested():
    event = {
        "contexts": {
            "task": {
                "deep": {"raw_text": "глубокий секрет"},
            },
        }
    }
    out = _redact_raw_text(event)
    assert out["contexts"]["task"]["deep"]["raw_text"] == "<redacted>"


def test_redact_handles_lists_and_primitives():
    event = {"contexts": [1, "string", {"raw_text": "x"}]}
    out = _redact_raw_text(event)
    assert out["contexts"][2]["raw_text"] == "<redacted>"


@pytest.mark.anyio
async def test_logs_do_not_contain_raw_text(client, caplog):
    """Creating a task with a unique-marker raw_text leaves no trace in logs."""
    secret_marker = "xyzqzq-частная-задача"

    db = MagicMock()
    insert_chain = MagicMock()
    insert_chain.insert.return_value = insert_chain
    insert_chain.execute.return_value.data = [
        {
            "id": "t-secret",
            "user_id": "u",
            "title": "тест",
            "status": "inbox",
            "raw_text": secret_marker,
        }
    ]
    db.table.return_value = insert_chain
    with patch("api.tasks.get_supabase", return_value=db), caplog.at_level(
        logging.DEBUG
    ):
        resp = await client.post(
            "/tasks/",
            json={"title": "тест", "raw_text": secret_marker, "status": "inbox"},
        )
    assert resp.status_code == 201

    for record in caplog.records:
        assert secret_marker not in record.getMessage(), (
            f"raw_text leaked into logs: {record.getMessage()}"
        )


@pytest.mark.anyio
async def test_delete_removes_task_row(client):
    db = MagicMock()
    delete_chain = MagicMock()
    delete_chain.delete.return_value = delete_chain
    delete_chain.eq.return_value = delete_chain
    delete_chain.execute.return_value.data = [{"id": "t-del"}]
    db.table.return_value = delete_chain
    with patch("api.tasks.get_supabase", return_value=db):
        resp = await client.delete("/tasks/t-del")
    assert resp.status_code == 204
    # Validate that delete() was actually called on the chain.
    delete_chain.delete.assert_called_once()
