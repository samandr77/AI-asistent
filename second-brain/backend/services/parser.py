from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from typing import NamedTuple

from pydantic import ValidationError

from services.ai_router import complete, AITier
from models.task import ParsedDump, ParsedTask, Priority, Sphere

PARSE_SYSTEM = """Ты — AI-ассистент для структурирования задач.
Пользователь даёт поток мыслей. Твоя задача:
- Каждое дело/намерение = отдельная задача
- Определить сферу: work/family/study/health/travel/finance/goals
- Определить приоритет: 1=низкий, 2=средний, 3=высокий
- is_today=true если нужно сделать сегодня или срочно
- deadline: ISO 8601 UTC если упомянуто ("в пятницу", "завтра", "через неделю")
- goal_id: null (заполняется сервером при необходимости)
- Отвечать ТОЛЬКО валидным JSON без markdown-обёртки

Формат ответа:
{"tasks": [{"title": "...", "sphere": "work", "priority": 2, "is_today": false, "deadline": null, "notes": null, "goal_id": null}]}"""

_GOAL_CONFIDENCE_THRESHOLD = 2
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)
_TASK_SPLIT_RE = re.compile(r"[.;\n]+|\s+\bи\b\s+", re.IGNORECASE)


class ParsedDumpWithUsage(NamedTuple):
    parsed: ParsedDump
    tokens: int


def _extract_json_object(raw: str) -> str:
    """Strip markdown fences and isolate the first {...} block from LLM prose."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        cleaned = "\n".join(lines[1:end])
    match = _JSON_OBJECT_RE.search(cleaned)
    if match:
        return match.group(0)
    return cleaned


def _keyword_match_score(text: str, goal_title: str) -> int:
    text_lower = text.lower()
    words = [w for w in goal_title.lower().split() if len(w) >= 4]
    return sum(1 for w in words if w in text_lower)


def _auto_link_goals(tasks: list[ParsedTask], dump_text: str, active_goals: list[dict]) -> list[ParsedTask]:
    if not active_goals:
        return tasks
    result = []
    for task in tasks:
        if task.goal_id:
            result.append(task)
            continue
        combined = f"{task.title} {dump_text}"
        best_goal_id = None
        best_score = 0
        for goal in active_goals:
            if goal.get("status") != "active":
                continue
            score = _keyword_match_score(combined, goal.get("title", ""))
            if score > best_score:
                best_score = score
                best_goal_id = goal["id"]
        if best_score >= _GOAL_CONFIDENCE_THRESHOLD and best_goal_id:
            result.append(task.model_copy(update={"goal_id": best_goal_id}))
        else:
            result.append(task)
    return result


def _fallback_parse_dump(text: str) -> ParsedDump:
    cleaned = text.strip()
    parts = [part.strip(" ,:-") for part in _TASK_SPLIT_RE.split(cleaned)]
    tasks: list[ParsedTask] = []
    lowered_all = cleaned.lower()
    is_today = any(word in lowered_all for word in ("сегодня", "срочно", "сейчас"))
    for part in parts:
        if not part:
            continue
        title = re.sub(r"^(сегодня|завтра|надо|нужно|еще|ещё)\s+", "", part, flags=re.IGNORECASE).strip()
        if not title:
            continue
        lowered = title.lower()
        sphere = Sphere.finance if any(word in lowered for word in ("оплат", "деньг", "счет", "счёт", "чек")) else Sphere.work
        priority = Priority.high if any(word in lowered for word in ("срочно", "важно", "дедлайн")) else Priority.medium
        tasks.append(
            ParsedTask(
                title=title[:200],
                sphere=sphere,
                priority=priority,
                is_today=is_today or "сегодня" in lowered,
                notes="Создано локальным fallback-парсером после ошибки AI.",
            )
        )
    if not tasks:
        tasks.append(
            ParsedTask(
                title=cleaned[:200],
                sphere=Sphere.work,
                priority=Priority.medium,
                is_today=is_today,
                notes="Создано локальным fallback-парсером после ошибки AI.",
            )
        )
    return ParsedDump(tasks=tasks)


async def parse_dump(
    text: str,
    user_context: dict,
    active_goals: list[dict] | None = None,
    tier_policy: list[str] | None = None,
) -> ParsedDumpWithUsage:
    """Parse raw dump into ParsedDump + token accounting.

    On malformed JSON from the cheapest tier, retry on the next tier before failing.
    tier_policy: optional allowlist (passed through to ai_router.complete).
    """
    if not text or not text.strip():
        raise ValueError("Cannot parse empty text")

    context_parts = []
    if user_context.get("role"):
        context_parts.append(f"Роль: {user_context['role']}")
    if user_context.get("living_with"):
        context_parts.append(f"Живёт: {user_context['living_with']}")
    if user_context.get("peak_hours"):
        context_parts.append(f"Активность: {user_context['peak_hours']}")

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    user_prompt = f"""Сейчас: {now_str}

Контекст продукта:
Это персональный ассистент, который принимает свободную запись пользователя и превращает ее в конкретные задачи.
Запись может содержать бытовые дела, рабочие задачи, финансовые действия, здоровье, учебу, поездки, цели и напоминания.
Нужно вернуть только структурированный JSON по схеме из system prompt, без markdown, без пояснений и без текста вне JSON.

Пример:
Дамп пользователя: "Сегодня оплатить интернет и купить молоко, завтра позвонить бухгалтеру"
Ответ: {{"tasks":[{{"title":"Оплатить интернет","sphere":"finance","priority":2,"is_today":true,"deadline":null,"notes":null,"goal_id":null}},{{"title":"Купить молоко","sphere":"family","priority":2,"is_today":true,"deadline":null,"notes":null,"goal_id":null}},{{"title":"Позвонить бухгалтеру","sphere":"work","priority":2,"is_today":false,"deadline":null,"notes":null,"goal_id":null}}]}}
"""
    if context_parts:
        user_prompt += "\n".join(context_parts) + "\n"
    user_prompt += f"\nДамп пользователя:\n{text}"

    total_tokens = 0
    for tier in (AITier.cheap, AITier.medium):
        try:
            result = await complete(
                PARSE_SYSTEM, user_prompt, tier=tier, tier_policy=tier_policy
            )
        except RuntimeError:
            # If policy/tier blocks the call, bail out with the accumulated error.
            break
        total_tokens += result.tokens
        try:
            data = json.loads(_extract_json_object(result.text))
            if "tasks" not in data or not isinstance(data["tasks"], list):
                raise ValueError("LLM response missing 'tasks' list")
            parsed = ParsedDump(**data)
        except (json.JSONDecodeError, ValidationError, ValueError):
            continue

        if active_goals:
            linked = _auto_link_goals(parsed.tasks, text, active_goals)
            parsed = ParsedDump(tasks=linked)
        return ParsedDumpWithUsage(parsed=parsed, tokens=total_tokens)

    parsed = _fallback_parse_dump(text)
    if active_goals:
        parsed = ParsedDump(tasks=_auto_link_goals(parsed.tasks, text, active_goals))
    return ParsedDumpWithUsage(parsed=parsed, tokens=total_tokens)
