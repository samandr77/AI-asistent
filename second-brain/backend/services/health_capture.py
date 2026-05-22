from __future__ import annotations

from datetime import date
from typing import Any

from database import get_supabase
from models.task import ParsedHealthEvent
from services.health_sleep import calculate_sleep_quality, duration_between_minutes, parse_dt
from services.task_utils import now_iso


SAVE_CONFIDENCE_THRESHOLD = 0.6


def _today() -> str:
    return date.today().isoformat()


def _event_date(event: ParsedHealthEvent, data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if value:
            return str(value)
    if event.event_date:
        return event.event_date.isoformat()
    return _today()


def _clean_payload(data: dict[str, Any], allowed: set[str]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key in allowed and value is not None}


def _insert(table: str, row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table(table).insert(row).execute()
    rows = result.data or []
    return rows[0] if rows else None


def _save_sleep(event: ParsedHealthEvent, user_id: str) -> dict[str, Any] | None:
    data = dict(event.data)
    row = _clean_payload(
        data,
        {
            "sleep_date",
            "bedtime_at",
            "wake_at",
            "bedtime",
            "wake_time",
            "source",
            "time_in_bed_minutes",
            "duration_minutes",
            "sleep_latency_minutes",
            "awakenings_count",
            "awake_minutes",
            "restoration",
            "phases",
            "factors",
            "notes",
        },
    )
    if not row.get("duration_minutes"):
        duration = duration_between_minutes(row.get("bedtime_at"), row.get("wake_at"))
        if duration:
            row["duration_minutes"] = duration
    if not row.get("duration_minutes"):
        return None
    wake_dt = parse_dt(row.get("wake_at"))
    row["sleep_date"] = _event_date(event, data, "sleep_date")
    if not data.get("sleep_date") and wake_dt:
        row["sleep_date"] = wake_dt.date().isoformat()
    row["source"] = row.get("source") or "ai"
    row["user_id"] = user_id
    score, breakdown = calculate_sleep_quality(row)
    row["quality_score"] = score
    row["quality_breakdown"] = breakdown
    row["quality"] = round(score / 10)
    return _insert("health_sleep_logs", row)


def _save_activity(event: ParsedHealthEvent, user_id: str) -> dict[str, Any] | None:
    data = dict(event.data)
    row = _clean_payload(
        data,
        {
            "activity_date",
            "steps",
            "distance_meters",
            "active_minutes",
            "calories",
            "stand_hours",
            "source",
        },
    )
    if not any(row.get(key) for key in ("steps", "distance_meters", "active_minutes", "calories", "stand_hours")):
        return None
    row["activity_date"] = _event_date(event, data, "activity_date")
    row["source"] = row.get("source") or "ai"
    row["user_id"] = user_id
    return _insert("health_activity_logs", row)


def _save_workout(event: ParsedHealthEvent, user_id: str) -> dict[str, Any] | None:
    data = dict(event.data)
    row = _clean_payload(
        data,
        {
            "occurred_on",
            "kind",
            "title",
            "duration_minutes",
            "intensity",
            "calories",
            "muscle_groups",
            "notes",
        },
    )
    if not row.get("title"):
        return None
    row["occurred_on"] = _event_date(event, data, "occurred_on")
    row["kind"] = row.get("kind") or "other"
    row["user_id"] = user_id
    return _insert("health_workouts", row)


def _save_meal(event: ParsedHealthEvent, user_id: str) -> dict[str, Any] | None:
    data = dict(event.data)
    items = data.get("items")
    if not isinstance(items, list) or not items:
        return None
    meal = {
        "user_id": user_id,
        "logged_on": _event_date(event, data, "logged_on"),
        "meal_type": data.get("meal_type") or "snack",
        "title": data.get("title"),
        "source": data.get("source") or "ai",
        "confidence": event.confidence,
        "notes": data.get("notes"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    created = _insert("health_meal_entries", meal)
    if not created:
        return None
    meal_id = created["id"]
    rows = []
    for item in items[:40]:
        if not isinstance(item, dict) or not item.get("name"):
            continue
        rows.append(
            {
                "user_id": user_id,
                "meal_id": meal_id,
                "food_id": item.get("food_id"),
                "name": str(item["name"])[:180],
                "serving_qty": item.get("serving_qty") or 1,
                "serving_name": item.get("serving_name") or "порция",
                "grams": item.get("grams"),
                "calories": item.get("calories"),
                "protein_g": item.get("protein_g"),
                "carbs_g": item.get("carbs_g"),
                "fat_g": item.get("fat_g"),
                "fiber_g": item.get("fiber_g"),
                "confidence": item.get("confidence", event.confidence),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
        )
        if item.get("name") and item.get("grams"):
            _upsert_local_food(user_id, item, event.confidence)
    if rows:
        get_supabase().table("health_meal_items").insert(rows).execute()
    created["items"] = rows
    return created


def _upsert_local_food(user_id: str, item: dict[str, Any], confidence: float) -> None:
    grams = float(item.get("grams") or 0)
    if grams <= 0:
        return
    multiplier = 100 / grams
    row = {
        "user_id": user_id,
        "name": str(item["name"])[:180],
        "serving_name": item.get("serving_name") or "порция",
        "serving_grams": grams,
        "calories_per_100g": (item.get("calories") or 0) * multiplier if item.get("calories") is not None else None,
        "protein_per_100g": (item.get("protein_g") or 0) * multiplier if item.get("protein_g") is not None else None,
        "carbs_per_100g": (item.get("carbs_g") or 0) * multiplier if item.get("carbs_g") is not None else None,
        "fat_per_100g": (item.get("fat_g") or 0) * multiplier if item.get("fat_g") is not None else None,
        "fiber_per_100g": (item.get("fiber_g") or 0) * multiplier if item.get("fiber_g") is not None else None,
        "source": "ai",
        "confidence": confidence,
        "updated_at": now_iso(),
    }
    get_supabase().table("health_foods").upsert(
        row,
        on_conflict="user_id,name,brand",
    ).execute()


def _save_water(event: ParsedHealthEvent, user_id: str) -> dict[str, Any] | None:
    data = dict(event.data)
    amount = data.get("amount_ml")
    if not amount:
        return None
    row = {
        "user_id": user_id,
        "logged_on": _event_date(event, data, "logged_on"),
        "amount_ml": amount,
        "source": data.get("source") or "ai",
        "created_at": now_iso(),
    }
    return _insert("health_water_logs", row)


def save_health_events(events: list[ParsedHealthEvent], user_id: str) -> dict[str, Any]:
    saved: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    for event in events:
        if event.confidence < SAVE_CONFIDENCE_THRESHOLD:
            pending.append(event.model_dump())
            continue
        created = None
        try:
            if event.type == "sleep_log":
                created = _save_sleep(event, user_id)
            elif event.type == "activity_log":
                created = _save_activity(event, user_id)
            elif event.type == "workout":
                created = _save_workout(event, user_id)
            elif event.type == "nutrition_meal":
                created = _save_meal(event, user_id)
            elif event.type == "water_log":
                created = _save_water(event, user_id)
        except Exception:
            pending.append(event.model_dump())
            continue
        if created:
            saved.append({"type": event.type, "row": created, "confidence": event.confidence})
        else:
            pending.append(event.model_dump())
    return {"saved_health_events": saved, "pending_health_events": pending}
