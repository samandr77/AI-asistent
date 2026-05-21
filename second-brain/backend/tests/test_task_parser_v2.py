"""Phase 1 tests: extended NLP parser.

LLM is fully mocked — these are deterministic unit tests. Real-AI integration
is a separate test marked `@pytest.mark.integration` (not run by default).
"""
from __future__ import annotations

import json
import logging
from typing import Any

import pytest

from services import task_parser
from services.ai_router import AITier, AIResult
from tests.fixtures.parser_corpus import CORPUS


def _make_ai_result(payload: dict, tier: AITier = AITier.cheap) -> AIResult:
    return AIResult(text=json.dumps(payload), tokens=42, tier=tier)


def _corpus_task_payload(entry: dict) -> dict:
    """Build a synthetic parser output matching the expected fields for a corpus entry."""
    expected = entry["expected"]
    task: dict[str, Any] = {
        "title": expected.get(
            "title_contains", entry["text"][:60].capitalize()
        )
        if entry["ambiguous"] is False
        else entry["text"][:60].capitalize(),
        "source_text": entry["text"],
        "sphere": expected.get("sphere"),
        "priority": expected.get("priority", 2),
        "is_today": expected.get("is_today", False),
        "deadline": None,
        "time_of_day": expected.get("time_of_day"),
        "duration_estimated_min": expected.get("duration_estimated_min"),
        "contact": expected.get("contact"),
        "url": expected.get("url"),
        "notes": None,
        "goal_id": None,
        "clarification_questions": (
            ["Когда дедлайн?", "Что именно сделать?"]
            if entry["ambiguous"]
            else []
        ),
    }
    return task


@pytest.mark.anyio
async def test_corpus_accuracy(monkeypatch):
    """Mocked LLM returns synthetic answers; assert ≥85% on time, ≥80% on contact."""
    text_to_payload = {
        entry["text"]: {"tasks": [_corpus_task_payload(entry)]}
        for entry in CORPUS
    }

    async def fake_complete(system, user, **_kwargs):
        return _make_ai_result(text_to_payload[user])

    monkeypatch.setattr("services.task_parser.complete", fake_complete)

    time_hits = 0
    time_total = 0
    contact_hits = 0
    contact_total = 0

    for entry in CORPUS:
        result = await task_parser.parse(entry["text"])
        assert len(result.tasks) == 1, f"unexpected task count for: {entry['text']}"
        task = result.tasks[0]
        if "time_of_day" in entry["must_have"]:
            time_total += 1
            if task.time_of_day:
                time_hits += 1
        if "contact" in entry["must_have"]:
            contact_total += 1
            if task.contact:
                contact_hits += 1

    time_acc = time_hits / time_total if time_total else 1.0
    contact_acc = contact_hits / contact_total if contact_total else 1.0
    assert time_acc >= 0.85, f"time accuracy {time_acc:.2%} < 85%"
    assert contact_acc >= 0.80, f"contact accuracy {contact_acc:.2%} < 80%"


@pytest.mark.anyio
async def test_clarification_questions_for_ambiguous(monkeypatch):
    payload = {
        "tasks": [
            {
                "title": "Подготовить отчёт",
                "source_text": "подготовить отчёт",
                "sphere": None,
                "priority": 2,
                "is_today": False,
                "deadline": None,
                "time_of_day": None,
                "duration_estimated_min": None,
                "contact": None,
                "url": None,
                "notes": None,
                "goal_id": None,
                "clarification_questions": ["Когда дедлайн?", "К какому проекту?"],
            }
        ]
    }

    async def fake_complete(*args, **kwargs):
        return _make_ai_result(payload)

    monkeypatch.setattr("services.task_parser.complete", fake_complete)
    result = await task_parser.parse("подготовить отчёт")
    assert len(result.tasks[0].clarification_questions) >= 1


@pytest.mark.anyio
async def test_fallback_on_invalid_json(monkeypatch):
    async def fake_complete(*args, **kwargs):
        return AIResult(text="not json at all", tokens=10, tier=AITier.cheap)

    monkeypatch.setattr("services.task_parser.complete", fake_complete)
    result = await task_parser.parse("купить хлеб")
    assert result.used_fallback is True
    assert len(result.tasks) >= 1
    assert result.tasks[0].source_text  # raw preserved


@pytest.mark.anyio
async def test_fallback_on_budget_exhausted(monkeypatch):
    async def fake_complete(*args, **kwargs):
        raise RuntimeError("budget exhausted")

    monkeypatch.setattr("services.task_parser.complete", fake_complete)
    result = await task_parser.parse("сделать что-то важное")
    assert result.used_fallback is True
    assert result.tasks


@pytest.mark.anyio
async def test_no_raw_text_in_logs(monkeypatch, caplog):
    secret = "уникальная-фраза-xyzqzq"

    async def fake_complete(*args, **kwargs):
        return _make_ai_result(
            {
                "tasks": [
                    {
                        "title": "Сделать",
                        "source_text": secret,
                        "sphere": None,
                        "priority": 2,
                        "is_today": False,
                        "deadline": None,
                        "time_of_day": None,
                        "duration_estimated_min": None,
                        "contact": None,
                        "url": None,
                        "notes": None,
                        "goal_id": None,
                        "clarification_questions": [],
                    }
                ]
            }
        )

    monkeypatch.setattr("services.task_parser.complete", fake_complete)
    with caplog.at_level(logging.INFO):
        await task_parser.parse(secret)

    for record in caplog.records:
        assert secret not in record.getMessage(), (
            f"raw_text leaked into log: {record.getMessage()}"
        )


@pytest.mark.anyio
async def test_empty_text_raises():
    with pytest.raises(ValueError):
        await task_parser.parse("   ")
