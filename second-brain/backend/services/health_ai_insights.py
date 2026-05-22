from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from postgrest.exceptions import APIError
from pydantic import ValidationError

from database import get_supabase
from models.health import HealthInsight
from services import ai_router


SYSTEM = """Ты — AI-помощник по здоровью внутри Second Brain.
Задача: дать короткие, безопасные и практичные рекомендации по сну, активности, тренировкам и питанию.
Правила:
- Не ставь диагнозы.
- Не назначай лечение, препараты, дозировки или медицинские процедуры.
- Не утверждай причинность, если данных мало: пиши "может быть связано" или "похоже на".
- Если есть тревожный симптом или устойчивое ухудшение, советуй обратиться к врачу.
- Верни только валидный JSON без markdown.

Формат:
{"insights":[{"id":"stable-id","severity":"info|warning|critical","title":"...","message":"...","suggested_action":"...","used_data":["health_sleep_logs"]}]}"""


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime,)):
        return value.isoformat()
    return str(value)


def input_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=_json_default)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def fallback_insights(payload: dict[str, Any]) -> list[HealthInsight]:
    latest_sleep = payload.get("latest_sleep") or {}
    latest_activity = payload.get("latest_activity") or {}
    nutrition = payload.get("nutrition_summary") or {}
    readiness = int(payload.get("readiness_score") or 0)
    result: list[HealthInsight] = []
    if readiness and readiness < 55:
        result.append(
            HealthInsight(
                id="fallback-readiness-low",
                severity="warning",
                title="Нагрузка сегодня лучше мягче",
                message="Суммарные данные по сну, активности и питанию выглядят ниже комфортного уровня.",
                suggested_action="Оставь одну главную задачу, добавь короткую прогулку и восстановительный вечер.",
                used_data=["health_sleep_logs", "health_activity_logs", "health_meal_entries"],
            )
        )
    if int(latest_sleep.get("duration_minutes") or 0) < 390:
        result.append(
            HealthInsight(
                id="fallback-sleep-short",
                severity="info",
                title="Сон короче ориентира",
                message="Последняя запись сна меньше 6,5 часов. Это сигнал для планирования нагрузки, не диагноз.",
                suggested_action="Сегодня не ставь максимум по тренировкам и отметь факторы сна вечером.",
                used_data=["health_sleep_logs"],
            )
        )
    if int(latest_activity.get("steps") or 0) < 3000:
        result.append(
            HealthInsight(
                id="fallback-activity-low",
                severity="info",
                title="Мало движения",
                message="Последняя активность ниже мягкого дневного ориентира.",
                suggested_action="Добавь 10-20 минут прогулки, если самочувствие позволяет.",
                used_data=["health_activity_logs"],
            )
        )
    if nutrition and float(nutrition.get("protein_g") or 0) < 60:
        result.append(
            HealthInsight(
                id="fallback-protein-low",
                severity="info",
                title="Белок пока низко",
                message="По дневнику питания белка сегодня немного относительно базового ориентира.",
                suggested_action="Добавь белковый продукт в следующий приём пищи и проверь порции.",
                used_data=["health_meal_entries", "health_meal_items"],
            )
        )
    return result[:5]


def _parse_insights(raw: str) -> list[HealthInsight]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= start:
        cleaned = cleaned[start : end + 1]
    data = json.loads(cleaned)
    items = data.get("insights")
    if not isinstance(items, list):
        raise ValueError("Missing insights list")
    return [HealthInsight(**item) for item in items[:5]]


def _cache_get(user_id: str, period_days: int, digest: str) -> list[HealthInsight] | None:
    try:
        result = (
            get_supabase()
            .table("health_ai_insight_cache")
            .select("insights_json")
            .eq("user_id", user_id)
            .eq("period_days", period_days)
            .eq("input_hash", digest)
            .limit(1)
            .execute()
        )
    except APIError:
        return None
    rows = result.data or []
    if not rows:
        return None
    try:
        return [HealthInsight(**item) for item in rows[0].get("insights_json", [])]
    except (TypeError, ValidationError):
        return None


def _cache_put(
    user_id: str,
    period_days: int,
    digest: str,
    insights: list[HealthInsight],
    *,
    tokens: int,
    tier: str,
) -> None:
    try:
        get_supabase().table("health_ai_insight_cache").upsert(
            {
                "user_id": user_id,
                "period_days": period_days,
                "input_hash": digest,
                "insights_json": [item.model_dump() for item in insights],
                "tokens": tokens,
                "tier": tier,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id,period_days,input_hash",
        ).execute()
    except APIError:
        return


async def generate_health_insights(
    user_id: str,
    payload: dict[str, Any],
    *,
    period_days: int,
    tier_policy: list[str] | None = None,
) -> tuple[list[HealthInsight], int]:
    digest = input_hash(payload)
    cached = _cache_get(user_id, period_days, digest)
    if cached is not None:
        return cached, 0

    prompt = json.dumps(payload, ensure_ascii=False, default=_json_default)
    try:
        result = await ai_router.complete(
            SYSTEM,
            prompt,
            tier=ai_router.AITier.cheap,
            max_tokens=1200,
            tier_policy=tier_policy,
        )
        insights = _parse_insights(result.text)
        _cache_put(
            user_id,
            period_days,
            digest,
            insights,
            tokens=result.tokens,
            tier=result.tier.value,
        )
        return insights, result.tokens
    except Exception:
        insights = fallback_insights(payload)
        _cache_put(user_id, period_days, digest, insights, tokens=0, tier="fallback")
        return insights, 0
