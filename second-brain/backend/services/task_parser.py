"""Extended NLP parser (spec 006 phase 1).

Wraps `services.ai_router.complete` with a system prompt tuned for
russian task text, returning `ParsedDumpV2` with time_of_day, duration,
contact, url, and clarification_questions. Falls back to the legacy
heuristic parser if the LLM is unavailable or returns invalid JSON.

NEVER log raw user text. Log only token counts, tier, latency, and
length stats.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from pydantic import ValidationError

from models.task import (
    ParsedDumpV2,
    ParsedTaskV2,
    Priority,
    Sphere,
)
from services.ai_router import AITier, complete
from services.parser import _fallback_parse_dump

logger = logging.getLogger(__name__)


PARSE_SYSTEM_V2 = """Ты — AI-парсер задач русскоязычного пользователя.

Получив свободный текст пользователя (одна или несколько мыслей), верни СТРОГИЙ JSON по схеме:

{
  "tasks": [
    {
      "title": "краткий заголовок задачи (без воды, без даты/времени внутри)",
      "source_text": "слайс оригинала, относящийся к этой задаче (если не выделить — повтори весь текст)",
      "sphere": "work" | "family" | "study" | "health" | "travel" | "finance" | "goals" | null,
      "priority": 1 | 2 | 3,           // 1=low, 2=medium, 3=high
      "is_today": true | false,
      "deadline": null | "ISO-8601 datetime",
      "time_of_day": null | "HH:MM",    // если упомянуто время
      "duration_estimated_min": null | int, // минут
      "contact": null | "имя",          // если упомянут человек (Маша, Иван, Алексей)
      "url": null | "url",
      "notes": null | "доп.заметка",
      "goal_id": null,
      "clarification_questions": []     // 0-2 уточнения если данных недостаточно
    }
  ]
}

ПРАВИЛА:
- "утром" → time_of_day="09:00"; "днём" → "13:00"; "вечером" → "19:00"; "ночью" → "22:00".
- "час" → duration=60; "полчаса" → 30.
- Контакт извлекать только когда явно есть имя собеседника (после глаголов: позвонить, написать, встретиться, созвон, спросить, уточнить).
- Сфера определяется по словам: оплат/счёт/деньг → finance; врач/анализ/тренировка → health; купить/семья → family; учёб → study; поездка → travel; цель → goals; остальное (работа, отчёт) → work.
- Если фраза совершенно неоднозначна (нет даты, нет контекста), верни задачу с пустыми полями и 1-2 уточняющими вопроса в clarification_questions, например: ["Когда дедлайн?", "К какому проекту относится?"].
- ВСЕГДА возвращай источник в source_text: точный фрагмент входного текста (можно весь текст, если не получается выделить).
- Никогда не пиши Markdown — только raw JSON. Никаких ```.

ПРИМЕР:
Вход: "позвонить Маше завтра в 15:00 на 30 минут и купить хлеб"
Выход:
{"tasks":[
  {"title":"Позвонить Маше","source_text":"позвонить Маше завтра в 15:00 на 30 минут","sphere":"work","priority":2,"is_today":false,"deadline":null,"time_of_day":"15:00","duration_estimated_min":30,"contact":"Маша","url":null,"notes":null,"goal_id":null,"clarification_questions":[]},
  {"title":"Купить хлеб","source_text":"купить хлеб","sphere":"family","priority":2,"is_today":false,"deadline":null,"time_of_day":null,"duration_estimated_min":null,"contact":null,"url":null,"notes":null,"goal_id":null,"clarification_questions":[]}
]}
"""


_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_object(raw: str) -> str:
    match = _JSON_OBJECT_RE.search(raw)
    return match.group(0) if match else raw


def _to_v2_from_legacy(legacy, text: str) -> ParsedDumpV2:
    """Convert legacy ParsedDump (used by _fallback_parse_dump) to V2."""
    v2_tasks = []
    for t in legacy.tasks:
        v2_tasks.append(
            ParsedTaskV2(
                title=t.title,
                source_text=text[:2000],
                sphere=t.sphere,
                priority=t.priority,
                is_today=t.is_today,
                deadline=t.deadline,
                notes=(t.notes or "Создано локальным fallback-парсером после ошибки AI."),
                goal_id=t.goal_id,
            )
        )
    return ParsedDumpV2(tasks=v2_tasks, used_fallback=True)


async def parse(
    text: str,
    tier_policy: Optional[list[str]] = None,
) -> ParsedDumpV2:
    """Parse user text into ParsedDumpV2.

    On any AI/parse failure → fallback to the legacy local parser,
    wrapping the result in ParsedDumpV2 with used_fallback=True.
    """
    if not text or not text.strip():
        raise ValueError("Empty text passed to task_parser.parse")

    text = text[:2000]  # FR-NLP-005

    try:
        result = await complete(
            PARSE_SYSTEM_V2,
            text,
            tier=AITier.cheap,
            tier_policy=tier_policy,
            max_tokens=1500,
        )
    except Exception:
        # Budget exhausted, all tiers failed, network error — fall back.
        logger.info(
            "task_parser: AI unavailable, using local fallback (text_len=%d)",
            len(text),
        )
        legacy = _fallback_parse_dump(text)
        return _to_v2_from_legacy(legacy, text)

    raw_json = _extract_json_object(result.text)
    try:
        data = json.loads(raw_json)
        if "tasks" not in data or not isinstance(data["tasks"], list):
            raise ValueError("Missing tasks list")
        parsed = ParsedDumpV2(
            tasks=[ParsedTaskV2(**t) for t in data["tasks"]],
            tokens_used=result.tokens,
            used_fallback=False,
        )
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        logger.info(
            "task_parser: invalid AI JSON, using fallback (tier=%s, tokens=%d, err=%s)",
            result.tier.value,
            result.tokens,
            type(exc).__name__,
        )
        legacy = _fallback_parse_dump(text)
        return _to_v2_from_legacy(legacy, text)

    logger.info(
        "task_parser: parsed %d tasks (tier=%s, tokens=%d, clarifications=%d)",
        len(parsed.tasks),
        result.tier.value,
        result.tokens,
        sum(len(t.clarification_questions) for t in parsed.tasks),
    )
    return parsed


# Re-export for tests / external callers.
__all__ = ["parse", "PARSE_SYSTEM_V2", "ParsedDumpV2", "ParsedTaskV2", "Priority", "Sphere"]
