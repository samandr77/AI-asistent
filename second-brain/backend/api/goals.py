from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from auth import get_current_user_id
from database import get_supabase
from models.goal import GoalCreate, GoalUpdate
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


def _assert_goal_owned(goal_data: list, goal_id: str) -> dict:
    if not goal_data:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal_data[0]


@router.get("/")
async def list_goals(
    status: Optional[str] = None,
    sphere: Optional[str] = None,
    target_date_from: Optional[str] = None,
    target_date_to: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    q = db.table("goals").select("*").eq("user_id", user_id)
    if status:
        q = q.eq("status", status)
    if sphere:
        q = q.eq("sphere", sphere)
    if target_date_from:
        q = q.gte("target_date", target_date_from)
    if target_date_to:
        q = q.lte("target_date", target_date_to)
    result = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    result = db.table("goals").select("*").eq("id", goal_id).eq("user_id", user_id).execute()
    return _assert_goal_owned(result.data, goal_id)


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
    row = {k: v for k, v in row.items() if v is not None or k in ("description", "target_date", "sphere")}
    row["user_id"] = user_id
    if row.get("target_date") is not None:
        row["target_date"] = str(row["target_date"])
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
    if "target_date" in updates and updates["target_date"] is not None:
        updates["target_date"] = str(updates["target_date"])

    db = get_supabase()
    result = (
        db.table("goals")
        .update(updates)
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_goal_owned(result.data, goal_id)


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


@router.post("/{goal_id}/tasks/{task_id}", status_code=200)
async def link_task_to_goal(
    goal_id: str,
    task_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    goal_result = db.table("goals").select("id").eq("id", goal_id).eq("user_id", user_id).execute()
    _assert_goal_owned(goal_result.data, goal_id)

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
    _assert_goal_owned(goal_result.data, goal_id)

    result = (
        db.table("tasks")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .order("priority", desc=True)
        .execute()
    )
    return result.data


@router.get("/{goal_id}/progress")
async def get_goal_progress(
    goal_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    goal_result = db.table("goals").select("*").eq("id", goal_id).eq("user_id", user_id).execute()
    goal = _assert_goal_owned(goal_result.data, goal_id)

    tasks_result = (
        db.table("tasks")
        .select("is_done")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    tasks = tasks_result.data or []
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("is_done"))

    computed: Optional[int] = None
    if total > 0:
        computed = round((completed / total) * 100)

    return {
        "goal_id": goal_id,
        "manual_progress": goal["progress_percent"],
        "computed_progress": computed,
        "linked_tasks_count": total,
        "completed_tasks_count": completed,
    }
