"""Exercise library: system seed loader + search/filter helpers.

The system catalog lives in `health_exercises` rows with `user_id is null`.
On app startup we call `seed_if_empty()` — if zero system rows exist, we bulk
insert from `backend/data/exercises_seed.json`. Custom user exercises
(`user_id is not null`) are unaffected.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from database import get_supabase

logger = logging.getLogger(__name__)

_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "exercises_seed.json"


def _load_seed() -> list[dict[str, Any]]:
    if not _SEED_PATH.exists():
        logger.warning("exercise seed file missing at %s", _SEED_PATH)
        return []
    with _SEED_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Apply defaults so each seed entry has the columns the table expects."""
    return {
        "user_id": None,
        "slug": row["slug"],
        "name_ru": row["name_ru"],
        "name_en": row.get("name_en"),
        "primary_muscle": row["primary_muscle"],
        "secondary_muscles": row.get("secondary_muscles") or [],
        "equipment": row.get("equipment") or [],
        "category": row["category"],
        "is_compound": bool(row.get("is_compound", False)),
        "is_unilateral": bool(row.get("is_unilateral", False)),
        "default_rest_seconds": row.get("default_rest_seconds"),
        "tempo_default": row.get("tempo_default"),
        "instructions": row.get("instructions"),
        "gif_url": row.get("gif_url"),
        "video_url": row.get("video_url"),
        "thumbnail_url": row.get("thumbnail_url"),
        "difficulty": row.get("difficulty"),
        "sport_kind": row.get("sport_kind"),
        "metadata": row.get("metadata") or {},
    }


def seed_if_empty() -> int:
    """Insert system exercises if none are present yet.

    Returns the number of rows inserted (0 if the catalog was already seeded).
    Safe to call on every app start.
    """
    db = get_supabase()
    existing = (
        db.table("health_exercises")
        .select("id", count="exact")
        .is_("user_id", "null")
        .limit(1)
        .execute()
    )
    if (existing.count or 0) > 0:
        return 0

    seed = _load_seed()
    if not seed:
        return 0

    rows = [_normalize_row(r) for r in seed]
    # Supabase python client doesn't chunk large inserts; do it manually.
    inserted = 0
    chunk_size = 100
    for i in range(0, len(rows), chunk_size):
        batch = rows[i : i + chunk_size]
        result = db.table("health_exercises").insert(batch).execute()
        inserted += len(result.data or [])
    logger.info("seeded %d system exercises", inserted)
    return inserted


def list_exercises(
    *,
    user_id: str,
    muscle: str | None = None,
    equipment: str | None = None,
    category: str | None = None,
    sport_kind: str | None = None,
    difficulty: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Return exercises visible to the user (system rows + their own customs).

    RLS already filters; this function adds search/filter parameters.
    """
    db = get_supabase()
    query = db.table("health_exercises").select("*")

    if muscle:
        query = query.or_(f"primary_muscle.eq.{muscle},secondary_muscles.cs.{{{muscle}}}")
    if equipment:
        query = query.contains("equipment", [equipment])
    if category:
        query = query.eq("category", category)
    if sport_kind:
        query = query.eq("sport_kind", sport_kind)
    if difficulty:
        query = query.eq("difficulty", difficulty)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.or_(
            f"name_ru.ilike.{pattern},name_en.ilike.{pattern},slug.ilike.{pattern}"
        )

    # Surface user's own exercises first, then system catalog
    query = query.order("user_id", desc=True, nullsfirst=False).order("name_ru")
    query = query.range(offset, offset + limit - 1)

    result = query.execute()
    return result.data or []


def get_exercise(*, slug: str, user_id: str) -> dict[str, Any] | None:
    """Look up an exercise by slug — prefer the user's custom override when present."""
    db = get_supabase()
    # User's own row with this slug takes precedence
    own = (
        db.table("health_exercises")
        .select("*")
        .eq("user_id", user_id)
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    if own.data:
        return own.data[0]

    system = (
        db.table("health_exercises")
        .select("*")
        .is_("user_id", "null")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    return system.data[0] if system.data else None


def get_exercise_by_id(*, exercise_id: str) -> dict[str, Any] | None:
    db = get_supabase()
    result = (
        db.table("health_exercises")
        .select("*")
        .eq("id", exercise_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def popular_for_user(*, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Top exercises by recent set count for the given user."""
    db = get_supabase()
    # Pull recent set rows, count by exercise_id, then fetch those exercises.
    sets = (
        db.table("health_workout_sets")
        .select("exercise_id")
        .eq("user_id", user_id)
        .order("completed_at", desc=True, nullsfirst=False)
        .limit(500)
        .execute()
    )
    if not sets.data:
        return []
    counts: dict[str, int] = {}
    for row in sets.data:
        eid = row.get("exercise_id")
        if eid:
            counts[eid] = counts.get(eid, 0) + 1
    top_ids = [eid for eid, _ in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]]
    if not top_ids:
        return []
    result = (
        db.table("health_exercises")
        .select("*")
        .in_("id", top_ids)
        .execute()
    )
    rows = result.data or []
    # Preserve count-based ordering
    order = {eid: i for i, eid in enumerate(top_ids)}
    rows.sort(key=lambda r: order.get(r["id"], len(order)))
    return rows
