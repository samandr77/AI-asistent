import pytest
import json
from unittest.mock import AsyncMock, patch
from datetime import datetime

SAMPLE_LLM_RESPONSE = json.dumps({
    "tasks": [
        {"title": "Купить молоко", "sphere": "family", "priority": 2, "is_today": True},
        {"title": "Сдать отчёт", "sphere": "work", "priority": 3, "is_today": True, "deadline": "2026-04-15T18:00:00Z"},
        {"title": "Записаться к врачу", "sphere": "health", "priority": 2, "is_today": True},
        {"title": "Прочитать книгу", "sphere": "study", "priority": 1, "is_today": False},
        {"title": "Купить билеты", "sphere": "travel", "priority": 2, "is_today": False},
    ]
})

@pytest.mark.anyio
async def test_parse_dump_returns_tasks():
    with patch("services.parser.complete", new=AsyncMock(return_value=SAMPLE_LLM_RESPONSE)):
        from services.parser import parse_dump
        result = await parse_dump("купить молоко, сдать отчёт в пятницу", {})
    assert len(result.tasks) == 5
    assert result.tasks[0].sphere.value == "family"
    assert len(result.today_top3) == 3
    assert all(t.is_today for t in result.today_top3)
    assert result.today_top3[0].priority >= result.today_top3[-1].priority
    work_task = next(t for t in result.tasks if t.sphere.value == "work")
    assert work_task.deadline is not None
    assert isinstance(work_task.deadline, datetime)

@pytest.mark.anyio
async def test_parse_dump_empty_text_raises():
    from services.parser import parse_dump
    with pytest.raises(ValueError, match="empty"):
        await parse_dump("", {})

@pytest.mark.anyio
async def test_parse_dump_invalid_json_raises():
    with patch("services.parser.complete", new=AsyncMock(return_value="not json")):
        from services.parser import parse_dump
        with pytest.raises(ValueError):
            await parse_dump("some text", {})
