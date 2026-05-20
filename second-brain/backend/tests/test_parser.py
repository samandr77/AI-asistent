import json
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from services.ai_router import AIResult, AITier
from services.parser import parse_dump, _extract_json_object

SAMPLE_TASKS = {
    "tasks": [
        {"title": "Купить молоко", "sphere": "family", "priority": 2, "is_today": True},
        {"title": "Сдать отчёт", "sphere": "work", "priority": 3, "is_today": True, "deadline": "2026-04-15T18:00:00Z"},
        {"title": "Записаться к врачу", "sphere": "health", "priority": 2, "is_today": True},
        {"title": "Прочитать книгу", "sphere": "study", "priority": 1, "is_today": False},
        {"title": "Купить билеты", "sphere": "travel", "priority": 2, "is_today": False},
    ]
}
SAMPLE_LLM_RESPONSE = AIResult(
    text=json.dumps(SAMPLE_TASKS), tokens=500, tier=AITier.cheap,
)


@pytest.mark.anyio
async def test_parse_dump_returns_tasks():
    with patch("services.parser.complete", new=AsyncMock(return_value=SAMPLE_LLM_RESPONSE)):
        result = await parse_dump("купить молоко, сдать отчёт в пятницу", {})
    assert result.tokens == 500
    parsed = result.parsed
    assert len(parsed.tasks) == 5
    assert parsed.tasks[0].sphere.value == "family"
    assert len(parsed.today_top3) == 3
    assert all(t.is_today for t in parsed.today_top3)
    priorities = [t.priority.value for t in parsed.today_top3]
    assert priorities == sorted(priorities, reverse=True)
    work_task = next(t for t in parsed.tasks if t.sphere.value == "work")
    assert work_task.deadline is not None
    assert isinstance(work_task.deadline, datetime)


@pytest.mark.anyio
async def test_parse_dump_empty_text_raises():
    with pytest.raises(ValueError, match="empty"):
        await parse_dump("", {})


@pytest.mark.anyio
async def test_parse_dump_invalid_json_after_all_tiers_uses_local_fallback():
    bad = AIResult(text="not json", tokens=100, tier=AITier.cheap)
    with patch("services.parser.complete", new=AsyncMock(return_value=bad)):
        result = await parse_dump("some text", {})

    assert result.tokens == 200
    assert len(result.parsed.tasks) == 1
    assert result.parsed.tasks[0].title == "some text"


def test_extract_json_object_from_prose():
    raw = 'Here is the JSON: {"tasks": [{"title": "x", "sphere": "work", "priority": 1, "is_today": false}]} end.'
    assert "tasks" in _extract_json_object(raw)


def test_extract_json_strips_markdown_fence():
    raw = '```json\n{"tasks": []}\n```'
    assert _extract_json_object(raw).strip() == '{"tasks": []}'


@pytest.mark.anyio
async def test_parser_falls_back_to_medium_tier_on_bad_json():
    valid = AIResult(
        text='{"tasks": [{"title": "t", "sphere": "work", "priority": 1, "is_today": true}]}',
        tokens=200, tier=AITier.medium,
    )
    responses = iter([
        AIResult(text="not json", tokens=100, tier=AITier.cheap),
        valid,
    ])

    async def fake_complete(*args, **kwargs):
        return next(responses)

    with patch("services.parser.complete", new=fake_complete):
        result = await parse_dump("some dump", {})
    assert result.tokens == 300
    assert len(result.parsed.tasks) == 1
