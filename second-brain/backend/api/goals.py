from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from auth import get_current_user_id
from database import get_supabase
from models.goal import (
    GoalCreate,
    GoalUpdate,
    KeyResultCreate,
    KeyResultUpdate,
)
from services.okr_progress import (
    aggregate_goal_progress,
    build_okr_tree,
    compute_kr_progress,
    derive_kr_status,
)
from services.premium import get_user_premium, get_max_active_goals

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _rate_limit = _limiter.limit("20/minute")
except ModuleNotFoundError:
    def _rate_limit(func):
        return func

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _assert_owned(rows: list, name: str = "resource") -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=f"{name} not found")
    return rows[0]


# ─────────────────────────────────────────────────────────────────────────────
# Goals — CRUD
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_goals(
    status: Optional[str] = None,
    sphere: Optional[str] = None,
    level: Optional[str] = None,
    parent_goal_id: Optional[str] = None,
    target_date_from: Optional[str] = None,
    target_date_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    q = db.table("goals").select("*").eq("user_id", user_id)
    if status:
        q = q.eq("status", status)
    if sphere:
        q = q.eq("sphere", sphere)
    if level:
        q = q.eq("level", level)
    if parent_goal_id:
        q = q.eq("parent_goal_id", parent_goal_id)
    if target_date_from:
        q = q.gte("target_date", target_date_from)
    if target_date_to:
        q = q.lte("target_date", target_date_to)
    result = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/tree")
async def get_goal_tree(
    user_id: str = Depends(get_current_user_id),
):
    """Return goals as a nested OKR tree with progress for each node."""
    db = get_supabase()
    goals = (
        db.table("goals")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    ).data or []

    progress_map: dict[str, dict] = {}
    for goal in goals:
        krs = (
            db.table("goal_key_results")
            .select("*")
            .eq("goal_id", goal["id"])
            .eq("user_id", user_id)
            .execute()
        ).data or []
        tasks = (
            db.table("tasks")
            .select("is_done")
            .eq("goal_id", goal["id"])
            .eq("user_id", user_id)
            .execute()
        ).data or []
        children = (
            db.table("goals")
            .select("id")
            .eq("parent_goal_id", goal["id"])
            .eq("user_id", user_id)
            .execute()
        ).data or []
        snapshot = aggregate_goal_progress(goal, krs, tasks)
        snapshot["children_count"] = len(children)
        progress_map[goal["id"]] = snapshot

    return build_okr_tree(goals, progress_map)


@router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    result = db.table("goals").select("*").eq("id", goal_id).eq("user_id", user_id).execute()
    return _assert_owned(result.data, "Goal")


async def _enforce_goal_limit(user_id: str) -> None:
    """Raises HTTP 402 if the free-tier active goal limit is exceeded."""
    premium = await get_user_premium(user_id)
    limit = get_max_active_goals(premium)
    if premium.is_premium:
        return
    db = get_supabase()
    result = (
        db.table("goals")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    count = result.count or 0
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "goal_limit_reached",
                "upgrade_url": "/premium/paywall",
                "limit": limit,
                "used": count,
            },
        )


@router.post("/", status_code=201)
async def create_goal(
    request: Request,
    body: GoalCreate,
    user_id: str = Depends(get_current_user_id),
):
    await _enforce_goal_limit(user_id)
    db = get_supabase()
    row = body.model_dump(exclude_none=False)
    row = {
        k: v
        for k, v in row.items()
        if v is not None
        or k
        in (
            "description",
            "target_date",
            "sphere",
            "parent_goal_id",
            "horizon_start",
            "horizon_end",
        )
    }
    row["user_id"] = user_id
    for date_field in ("target_date", "horizon_start", "horizon_end"):
        if row.get(date_field) is not None:
            row[date_field] = str(row[date_field])

    if row.get("parent_goal_id"):
        parent = (
            db.table("goals")
            .select("id")
            .eq("id", row["parent_goal_id"])
            .eq("user_id", user_id)
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=422, detail="parent_goal_id not found")

    result = db.table("goals").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create goal")
    return result.data[0]


@router.patch("/{goal_id}")
async def update_goal(
    goal_id: str,
    request: Request,
    body: GoalUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    for date_field in ("target_date", "horizon_start", "horizon_end"):
        if date_field in updates and updates[date_field] is not None:
            updates[date_field] = str(updates[date_field])

    if updates.get("parent_goal_id") == goal_id:
        raise HTTPException(status_code=422, detail="parent_goal_id cannot be self")

    db = get_supabase()
    if updates.get("parent_goal_id"):
        parent = (
            db.table("goals")
            .select("id")
            .eq("id", updates["parent_goal_id"])
            .eq("user_id", user_id)
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=422, detail="parent_goal_id not found")

    result = (
        db.table("goals")
        .update(updates)
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_owned(result.data, "Goal")


@router.delete("/{goal_id}", status_code=204, response_class=Response)
async def delete_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    db = get_supabase()
    result = db.table("goals").delete().eq("id", goal_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Goal not found")
    return Response(status_code=204)


# ─────────────────────────────────────────────────────────────────────────────
# Goal ↔ Task linking
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/{goal_id}/tasks/{task_id}", status_code=200)
async def link_task_to_goal(
    goal_id: str,
    task_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    goal_result = db.table("goals").select("id").eq("id", goal_id).eq("user_id", user_id).execute()
    _assert_owned(goal_result.data, "Goal")

    task_result = (
        db.table("tasks")
        .update({"goal_id": goal_id, "updated_at": _now_iso()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not task_result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"goal_id": goal_id, "task_id": task_id}


@router.delete("/{goal_id}/tasks/{task_id}", status_code=200)
async def unlink_task_from_goal(
    goal_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    task_result = (
        db.table("tasks")
        .update({"goal_id": None, "updated_at": _now_iso()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .eq("goal_id", goal_id)
        .execute()
    )
    if not task_result.data:
        raise HTTPException(status_code=404, detail="Task not linked to this goal or not found")
    return {"goal_id": goal_id, "task_id": task_id}


@router.get("/{goal_id}/tasks")
async def list_goal_tasks(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    goal_result = db.table("goals").select("id").eq("id", goal_id).eq("user_id", user_id).execute()
    _assert_owned(goal_result.data, "Goal")

    result = (
        db.table("tasks")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .order("priority", desc=True)
        .execute()
    )
    return result.data


# ─────────────────────────────────────────────────────────────────────────────
# Goal progress (manual + computed + KR + tasks)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/{goal_id}/progress")
async def get_goal_progress(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    goal = _assert_owned(
        db.table("goals").select("*").eq("id", goal_id).eq("user_id", user_id).execute().data,
        "Goal",
    )

    krs = (
        db.table("goal_key_results")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []

    tasks = (
        db.table("tasks")
        .select("is_done")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []

    snapshot = aggregate_goal_progress(goal, krs, tasks)
    snapshot["goal_id"] = goal_id
    return snapshot


# ─────────────────────────────────────────────────────────────────────────────
# Key Results
# ─────────────────────────────────────────────────────────────────────────────


def _enrich_kr(kr: dict) -> dict:
    return {
        **kr,
        "progress_percent": compute_kr_progress(kr),
        "status": derive_kr_status(kr),
    }


@router.get("/{goal_id}/key-results")
async def list_key_results(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    _assert_owned(
        db.table("goals").select("id").eq("id", goal_id).eq("user_id", user_id).execute().data,
        "Goal",
    )
    result = (
        db.table("goal_key_results")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [_enrich_kr(kr) for kr in (result.data or [])]


@router.post("/{goal_id}/key-results", status_code=201)
async def create_key_result(
    goal_id: str,
    body: KeyResultCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    _assert_owned(
        db.table("goals").select("id").eq("id", goal_id).eq("user_id", user_id).execute().data,
        "Goal",
    )
    row = body.model_dump(exclude_none=False)
    row["goal_id"] = goal_id
    row["user_id"] = user_id
    if row.get("due_date") is not None:
        row["due_date"] = str(row["due_date"])
    result = db.table("goal_key_results").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create key result")
    return _enrich_kr(result.data[0])


@router.patch("/{goal_id}/key-results/{kr_id}")
async def update_key_result(
    goal_id: str,
    kr_id: str,
    body: KeyResultUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    if "due_date" in updates and updates["due_date"] is not None:
        updates["due_date"] = str(updates["due_date"])
    db = get_supabase()
    result = (
        db.table("goal_key_results")
        .update(updates)
        .eq("id", kr_id)
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _enrich_kr(_assert_owned(result.data, "Key result"))


@router.delete("/{goal_id}/key-results/{kr_id}", status_code=204, response_class=Response)
async def delete_key_result(
    goal_id: str,
    kr_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    db = get_supabase()
    result = (
        db.table("goal_key_results")
        .delete()
        .eq("id", kr_id)
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Key result not found")
    return Response(status_code=204)
