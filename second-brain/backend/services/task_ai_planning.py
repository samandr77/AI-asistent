from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from models.task import AIPlanningRequest
from services import ai_router
from services.task_utils import load_task_for_user

SYSTEM = """You are a task planning assistant. Return compact JSON only.
Never include private raw user text beyond the fields requested by the caller."""


def _json_or_text(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"items": parsed}
    except json.JSONDecodeError:
        return {"summary": text}


async def run(action: str, body: AIPlanningRequest, user_id: str, tier_policy: list[str] | None = None) -> dict:
    task: dict | None = None
    if body.task_id:
        task = load_task_for_user(body.task_id, user_id)
    prompt = {
        "action": action,
        "task": task,
        "text": body.text,
        "date": body.date.isoformat() if body.date else None,
        "task_ids": body.task_ids,
        "context": body.context,
    }
    try:
        result = await ai_router.complete(
            SYSTEM,
            json.dumps(prompt, ensure_ascii=False, default=str),
            tier=ai_router.AITier.cheap,
            max_tokens=1500,
            tier_policy=tier_policy,
        )
    except Exception as exc:  # pragma: no cover - defensive integration boundary
        raise HTTPException(status_code=502, detail="AI task planning failed") from exc
    return {
        "action": action,
        "result": _json_or_text(result.text),
        "tokens_used": result.tokens,
        "tier": result.tier.value,
    }
