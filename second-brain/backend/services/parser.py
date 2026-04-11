import json
from datetime import datetime, timezone
from services.ai_router import complete, AITier
from models.task import ParsedDump

PARSE_SYSTEM = """Ты — AI-ассистент для структурирования задач.
Пользователь даёт поток мыслей. Твоя задача:
- Каждое дело/намерение = отдельная задача
- Определить сферу: work/family/study/health/travel
- Определить приоритет: 1=низкий, 2=средний, 3=высокий
- is_today=true если нужно сделать сегодня или срочно
- deadline: ISO 8601 UTC если упомянуто ("в пятницу", "завтра", "через неделю")
- Отвечать ТОЛЬКО валидным JSON без markdown-обёртки

Формат ответа:
{"tasks": [{"title": "...", "sphere": "work", "priority": 2, "is_today": false, "deadline": null, "notes": null}]}"""

async def parse_dump(text: str, user_context: dict) -> ParsedDump:
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
    user_prompt = f"Сейчас: {now_str}\n"
    if context_parts:
        user_prompt += "\n".join(context_parts) + "\n"
    user_prompt += f"\nДамп пользователя:\n{text}"

    raw = await complete(PARSE_SYSTEM, user_prompt, tier=AITier.cheap)

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}")

    if "tasks" not in data or not isinstance(data["tasks"], list):
        raise ValueError("LLM response missing 'tasks' list")

    return ParsedDump(**data)
