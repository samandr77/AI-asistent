"""Workout session and set CRUD + finalize logic.

`finalize_session` is the place where post-completion derived values are
computed: training_load (TRIMP-like), intensity_minutes, and a future hook
for PR detection / goal KR bump (those plug in via separate services in
later phases). The `legacy_workout_mirror` DB trigger handles backwards
compatibility with `health_workouts` automatically.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from database import get_supabase

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

def _iso(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _payload(data: dict[str, Any]) -> dict[str, Any]:
    return {k: _iso(v) for k, v in data.items() if v is not None}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ----------------------------------------------------------------
# Sessions
# ----------------------------------------------------------------

def list_sessions(
    *,
    user_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    sport_kind: Optional[str] = None,
    is_completed: Optional[bool] = None,
    goal_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    db = get_supabase()
    query = db.table("health_workout_sessions").select("*").eq("user_id", user_id)
    if from_date:
        query = query.gte("occurred_on", from_date.isoformat())
    if to_date:
        query = query.lte("occurred_on", to_date.isoformat())
    if sport_kind:
        query = query.eq("sport_kind", sport_kind)
    if is_completed is not None:
        query = query.eq("is_completed", is_completed)
    if goal_id:
        query = query.eq("goal_id", goal_id)
    query = query.order("occurred_on", desc=True).order("created_at", desc=True)
    query = query.range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


def get_session(*, user_id: str, session_id: str) -> Optional[dict[str, Any]]:
    db = get_supabase()
    result = (
        db.table("health_workout_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_active_session(*, user_id: str) -> Optional[dict[str, Any]]:
    """Return the currently in-progress session (started, not ended, not completed)."""
    db = get_supabase()
    result = (
        db.table("health_workout_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_completed", False)
        .not_.is_("started_at", "null")
        .is_("ended_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def create_session(*, user_id: str, body: dict[str, Any]) -> dict[str, Any]:
    db = get_supabase()
    row = _payload({**body, "user_id": user_id})
    result = db.table("health_workout_sessions").insert(row).execute()
    if not result.data:
        raise RuntimeError("Failed to create workout session")
    return result.data[0]


def update_session(*, user_id: str, session_id: str, body: dict[str, Any]) -> dict[str, Any]:
    db = get_supabase()
    payload = _payload(body)
    if not payload:
        # No-op: fetch and return existing
        existing = get_session(user_id=user_id, session_id=session_id)
        if not existing:
            raise LookupError("session not found")
        return existing
    result = (
        db.table("health_workout_sessions")
        .update(payload)
        .eq("user_id", user_id)
        .eq("id", session_id)
        .execute()
    )
    if not result.data:
        raise LookupError("session not found")
    return result.data[0]


def delete_session(*, user_id: str, session_id: str) -> None:
    db = get_supabase()
    db.table("health_workout_sessions").delete().eq("user_id", user_id).eq("id", session_id).execute()
    # Cascade-delete sets via FK already; legacy mirror row cleaned manually:
    db.table("health_workouts").delete().eq("user_id", user_id).eq("id", session_id).execute()


def start_session(*, user_id: str, session_id: str) -> dict[str, Any]:
    return update_session(
        user_id=user_id,
        session_id=session_id,
        body={"started_at": _now_iso()},
    )


def finish_session(*, user_id: str, session_id: str) -> dict[str, Any]:
    """Mark a session completed and compute derived values.

    Idempotent: if already completed, returns the existing row without
    recomputing (re-running TRIMP / mirror trigger would be cheap but
    creates churn in updated_at).
    """
    session = get_session(user_id=user_id, session_id=session_id)
    if not session:
        raise LookupError("session not found")
    if session.get("is_completed"):
        return session

    ended_at = _now_iso()
    started_at = session.get("started_at")
    duration_minutes = session.get("duration_minutes")
    if not duration_minutes and started_at:
        try:
            start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end = datetime.now(timezone.utc)
            duration_minutes = max(1, int((end - start).total_seconds() // 60))
        except (TypeError, ValueError):
            duration_minutes = None

    sets = list_sets(user_id=user_id, session_id=session_id)
    training_load = compute_training_load(
        duration_minutes=duration_minutes,
        rpe=session.get("rpe"),
        sets=sets,
    )
    intensity_minutes = compute_intensity_minutes(
        duration_minutes=duration_minutes,
        rpe=session.get("rpe"),
    )

    update = {
        "is_completed": True,
        "ended_at": ended_at,
    }
    if duration_minutes is not None:
        update["duration_minutes"] = duration_minutes
    if training_load is not None:
        update["training_load_score"] = training_load
    if intensity_minutes is not None:
        update["intensity_minutes"] = intensity_minutes

    return update_session(user_id=user_id, session_id=session_id, body=update)


# ----------------------------------------------------------------
# Sets
# ----------------------------------------------------------------

def list_sets(*, user_id: str, session_id: str) -> list[dict[str, Any]]:
    db = get_supabase()
    result = (
        db.table("health_workout_sets")
        .select("*")
        .eq("user_id", user_id)
        .eq("session_id", session_id)
        .order("set_number")
        .order("created_at")
        .execute()
    )
    return result.data or []


def create_set(
    *,
    user_id: str,
    session_id: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    db = get_supabase()
    # Set completed_at to now if not provided — natural for live logging
    completed_at = body.get("completed_at") or _now_iso()
    row = _payload(
        {
            **body,
            "user_id": user_id,
            "session_id": session_id,
            "completed_at": completed_at,
        }
    )
    result = db.table("health_workout_sets").insert(row).execute()
    if not result.data:
        raise RuntimeError("Failed to create workout set")
    return result.data[0]


def update_set(*, user_id: str, set_id: str, body: dict[str, Any]) -> dict[str, Any]:
    db = get_supabase()
    payload = _payload(body)
    if not payload:
        existing = (
            db.table("health_workout_sets")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", set_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise LookupError("set not found")
        return existing.data[0]
    result = (
        db.table("health_workout_sets")
        .update(payload)
        .eq("user_id", user_id)
        .eq("id", set_id)
        .execute()
    )
    if not result.data:
        raise LookupError("set not found")
    return result.data[0]


def delete_set(*, user_id: str, set_id: str) -> None:
    db = get_supabase()
    db.table("health_workout_sets").delete().eq("user_id", user_id).eq("id", set_id).execute()


# ----------------------------------------------------------------
# Supersets
# ----------------------------------------------------------------

def create_superset(
    *,
    user_id: str,
    session_id: str,
    group_index: int,
    kind: str,
    notes: Optional[str],
    set_ids: list[str],
) -> dict[str, Any]:
    db = get_supabase()
    row = _payload(
        {
            "user_id": user_id,
            "session_id": session_id,
            "group_index": group_index,
            "kind": kind,
            "notes": notes,
        }
    )
    result = db.table("health_workout_supersets").insert(row).execute()
    if not result.data:
        raise RuntimeError("Failed to create superset")
    superset = result.data[0]
    # Tag the listed sets
    if set_ids:
        db.table("health_workout_sets").update({"superset_id": superset["id"]}).eq(
            "user_id", user_id
        ).in_("id", set_ids).execute()
    return superset


def list_supersets(*, user_id: str, session_id: str) -> list[dict[str, Any]]:
    db = get_supabase()
    result = (
        db.table("health_workout_supersets")
        .select("*")
        .eq("user_id", user_id)
        .eq("session_id", session_id)
        .order("group_index")
        .execute()
    )
    return result.data or []


# ----------------------------------------------------------------
# Derived metrics (lightweight — full algos in Phase 3+)
# ----------------------------------------------------------------

def compute_training_load(
    *,
    duration_minutes: Optional[int],
    rpe: Optional[int],
    sets: list[dict[str, Any]],
) -> Optional[float]:
    """TRIMP-style score: duration × RPE-derived intensity factor.

    When RPE is missing, fall back to a heuristic based on set count /
    average weight ratio (very rough — Phase 3 introduces proper
    Banister/Edwards). Returns None when there's not enough data.
    """
    if duration_minutes is None or duration_minutes <= 0:
        if not sets:
            return None
        # Approximate duration from set count if not provided
        duration_minutes = max(1, len(sets) * 2)

    effective_rpe = rpe
    if effective_rpe is None:
        # Heuristic: avg RPE from sets, otherwise default mid (6)
        rpes = [s.get("rpe") for s in sets if s.get("rpe") is not None]
        effective_rpe = int(sum(rpes) / len(rpes)) if rpes else 6

    # Intensity factor (Foster's session-RPE method): rpe / 10 → 0..1
    intensity = max(0.1, min(1.0, effective_rpe / 10.0))
    score = round(duration_minutes * intensity * 10, 2)  # scaled to ~0-1000
    return score


def compute_intensity_minutes(
    *,
    duration_minutes: Optional[int],
    rpe: Optional[int],
) -> Optional[int]:
    """WHO Intensity Minutes — moderate (≥RPE 4) counts 1×, vigorous (≥RPE 7) counts 2×.

    Returns None when no data; otherwise non-negative int.
    """
    if duration_minutes is None or duration_minutes <= 0:
        return None
    if rpe is None:
        # Default to moderate intensity
        return duration_minutes
    if rpe >= 7:
        return duration_minutes * 2
    if rpe >= 4:
        return duration_minutes
    return 0


def session_volume_kg(*, sets: list[dict[str, Any]]) -> float:
    """Total weight × reps across all working sets (warmups excluded)."""
    total = 0.0
    for s in sets:
        if s.get("is_warmup"):
            continue
        weight = s.get("weight_kg")
        reps = s.get("reps")
        if weight and reps:
            total += float(weight) * int(reps)
    return round(total, 2)
