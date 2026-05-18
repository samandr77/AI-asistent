from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from auth import get_current_user_id
from database import get_supabase
from services.premium import get_history_cutoff, get_user_premium

router = APIRouter()

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    sphere: Optional[str] = None
    priority: Optional[int] = None
    deadline: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    is_done: Optional[bool] = None
    is_today: Optional[bool] = None

@router.get("/today")
async def get_today_tasks(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    premium = await get_user_premium(user_id)
    cutoff = get_history_cutoff(premium)
    q = (
        db.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_today", True)
        .eq("is_done", False)
    )
    if cutoff is not None:
        q = q.gte("created_at", cutoff.isoformat())
    result = q.order("priority", desc=True).limit(3).execute()
    return result.data

@router.get("/")
async def get_all_tasks(
    sphere: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    premium = await get_user_premium(user_id)
    cutoff = get_history_cutoff(premium)
    q = db.table("tasks").select("*").eq("user_id", user_id).eq("is_done", False)
    if sphere:
        q = q.eq("sphere", sphere)
    if cutoff is not None:
        q = q.gte("created_at", cutoff.isoformat())
    result = q.order("priority", desc=True).range(offset, offset + limit - 1).execute()
    return result.data

@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "deadline" in updates and updates["deadline"] is not None:
        updates["deadline"] = updates["deadline"].isoformat()
    if "reminder_at" in updates and updates["reminder_at"] is not None:
        updates["reminder_at"] = updates["reminder_at"].isoformat()

    db = get_supabase()
    result = (
        db.table("tasks")
        .update(updates)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]

@router.delete("/{task_id}", status_code=204, response_class=Response)
async def delete_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    db = get_supabase()
    result = db.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)
