from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from auth import get_current_user_id
from database import get_supabase
from models.task import (
    BigThreeRequest,
    ChecklistItemCreate,
    FocusSessionCreate,
    SavedFilterCreate,
    TaskCaptureRequest,
    TaskCreate,
    TaskProcessAction,
    TaskProcessType,
    TaskStatus,
    TimeBlockCreate,
)
from services.premium import get_ai_tier_policy, get_history_cutoff, get_user_premium
from services import ai_budget, task_analytics, task_capture, task_planning, task_projects
from services.task_utils import create_user_row, list_user_rows, now_iso, payload_from_model

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
    status: Optional[TaskStatus] = None
    context: Optional[str] = None
    tags: Optional[list[str]] = None
    eisenhower_quadrant: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    duration_estimated_min: Optional[int] = None
    duration_actual_min: Optional[int] = None
    deep_work: Optional[bool] = None
    project_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    recurrence_rule: Optional[dict] = None
    habit_mode: Optional[bool] = None
    next_occurrence_at: Optional[datetime] = None


def _normalize_status_is_done(updates: dict) -> None:
    """Keep status and is_done in sync (invariant: status='done' ⟺ is_done=True)."""
    has_status = "status" in updates and updates["status"] is not None
    has_is_done = "is_done" in updates and updates["is_done"] is not None
    if has_status and not has_is_done:
        updates["is_done"] = updates["status"] == TaskStatus.done.value or updates["status"] == TaskStatus.done
    elif has_is_done and not has_status:
        updates["status"] = TaskStatus.done.value if updates["is_done"] else TaskStatus.active.value
    elif has_status and has_is_done:
        # Both set explicitly: enforce invariant, status wins.
        updates["is_done"] = updates["status"] in (TaskStatus.done, TaskStatus.done.value)
    if "status" in updates and isinstance(updates["status"], TaskStatus):
        updates["status"] = updates["status"].value


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


@router.get("/inbox")
async def get_inbox_tasks(
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    result = (
        db.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", TaskStatus.inbox.value)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.post("/", status_code=201)
async def create_task(
    body: TaskCreate,
    user_id: str = Depends(get_current_user_id),
):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "title": body.title,
        "raw_text": body.raw_text,
        "sphere": body.sphere.value if body.sphere else None,
        "priority": int(body.priority),
        "deadline": body.deadline.isoformat() if body.deadline else None,
        "reminder_at": body.reminder_at.isoformat() if body.reminder_at else None,
        "is_today": body.is_today,
        "status": body.status.value,
        "is_done": body.status == TaskStatus.done,
        "goal_id": body.goal_id,
        "notes": body.notes,
        "context": body.context,
        "tags": body.tags,
        "eisenhower_quadrant": body.eisenhower_quadrant.value if body.eisenhower_quadrant else None,
        "scheduled_start": body.scheduled_start.isoformat() if body.scheduled_start else None,
        "scheduled_end": body.scheduled_end.isoformat() if body.scheduled_end else None,
        "duration_estimated_min": body.duration_estimated_min,
        "duration_actual_min": body.duration_actual_min,
        "deep_work": body.deep_work,
        "project_id": body.project_id,
        "parent_task_id": body.parent_task_id,
        "recurrence_rule": body.recurrence_rule,
        "habit_mode": body.habit_mode,
        "source": body.source.value,
        "parser_metadata": body.parser_metadata,
        "created_at": now,
        "updated_at": now,
    }
    db = get_supabase()
    result = db.table("tasks").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return result.data[0]


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    _normalize_status_is_done(updates)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "deadline" in updates and updates["deadline"] is not None:
        updates["deadline"] = updates["deadline"].isoformat()
    if "reminder_at" in updates and updates["reminder_at"] is not None:
        updates["reminder_at"] = updates["reminder_at"].isoformat()
    for key in ("scheduled_start", "scheduled_end", "next_occurrence_at"):
        if key in updates and updates[key] is not None:
            updates[key] = updates[key].isoformat()
    if updates.get("is_done") is True and "completed_at" not in updates:
        updates["completed_at"] = updates["updated_at"]

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
    result = (
        db.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)


# ── Inbox process actions (spec 006) ──

_TERMINAL_STATUS_FOR_ACTION = {
    TaskProcessType.schedule: {TaskStatus.active.value},
    TaskProcessType.do_now: {TaskStatus.active.value},
    TaskProcessType.delegate: {TaskStatus.delegated.value},
    TaskProcessType.convert_project: {TaskStatus.active.value},
}


def _load_task_for_user(db, task_id: str, user_id: str) -> dict:
    res = (
        db.table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return res.data[0]


@router.post("/{task_id}/process")
async def process_task(
    task_id: str,
    body: TaskProcessAction,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    task = _load_task_for_user(db, task_id, user_id)

    action = body.action

    if action == TaskProcessType.delete:
        db.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
        return Response(status_code=204)

    target_statuses = _TERMINAL_STATUS_FOR_ACTION.get(action, set())
    if task.get("status") in target_statuses:
        return {"task": task, "already_processed": True}

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if action in (TaskProcessType.schedule, TaskProcessType.do_now):
        updates["status"] = TaskStatus.active.value
        updates["is_done"] = False
        if action == TaskProcessType.do_now:
            updates["is_today"] = True
        elif body.is_today is not None:
            updates["is_today"] = body.is_today
        if body.deadline is not None:
            updates["deadline"] = body.deadline.isoformat()
        if body.scheduled_start is not None:
            updates["scheduled_start"] = body.scheduled_start.isoformat()
        if body.scheduled_end is not None:
            updates["scheduled_end"] = body.scheduled_end.isoformat()
    elif action == TaskProcessType.delegate:
        updates["status"] = TaskStatus.delegated.value
        updates["is_done"] = False
        if body.delegate_to:
            existing_notes = task.get("notes") or ""
            tag = f"[delegated to {body.delegate_to}]"
            if tag not in existing_notes:
                updates["notes"] = (
                    f"{existing_notes}\n{tag}".strip() if existing_notes else tag
                )
    elif action == TaskProcessType.convert_project:
        updates["status"] = TaskStatus.active.value
        updates["is_done"] = False
        existing_notes = task.get("notes") or ""
        tag = "[project candidate]"
        if tag not in existing_notes:
            updates["notes"] = (
                f"{tag}\n{existing_notes}".strip() if existing_notes else tag
            )
    elif action == TaskProcessType.split_checklist:
        updates["status"] = TaskStatus.active.value
        updates["is_done"] = False
        for index, item in enumerate(body.checklist_items):
            db.table("task_checklist_items").insert(
                {
                    "user_id": user_id,
                    "task_id": task_id,
                    "title": item,
                    "position": index,
                    "is_done": False,
                    "created_at": now_iso(),
                }
            ).execute()

    result = (
        db.table("tasks")
        .update(updates)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": result.data[0], "already_processed": False}


@router.post("/capture", status_code=201)
async def capture_task_text(
    body: TaskCaptureRequest,
    user_id: str = Depends(get_current_user_id),
):
    premium = await get_user_premium(user_id)
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=429, detail="Daily AI budget exceeded")
    result = await task_capture.capture_text(
        body.text,
        user_id,
        source=body.source,
        tier_policy=get_ai_tier_policy(premium),
    )
    await ai_budget.record_usage(user_id, result.get("tokens_used", 0))
    return result


@router.get("/matrix")
async def get_task_matrix(user_id: str = Depends(get_current_user_id)):
    return task_planning.get_matrix(user_id)


@router.get("/big-three")
async def get_big_three(
    target_date: date,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.get_big_three(user_id, target_date)


@router.post("/big-three")
async def set_big_three(
    body: BigThreeRequest,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.set_big_three(user_id, body)


@router.get("/time-blocks")
async def get_time_blocks(
    target_date: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.get_time_blocks(user_id, target_date)


@router.post("/time-blocks", status_code=201)
async def create_time_block(
    body: TimeBlockCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.create_time_block(user_id, body)


@router.post("/{task_id}/focus-sessions", status_code=201)
async def create_focus_session(
    task_id: str,
    body: FocusSessionCreate,
    user_id: str = Depends(get_current_user_id),
):
    _load_task_for_user(get_supabase(), task_id, user_id)
    row = payload_from_model(body)
    if row.get("duration_min") is None and body.ended_at is not None:
        row["duration_min"] = max(
            1, round((body.ended_at - body.started_at).total_seconds() / 60)
        )
    elif row.get("duration_min") is None:
        row["duration_min"] = 25
    row.update({"user_id": user_id, "task_id": task_id, "created_at": now_iso()})
    result = get_supabase().table("task_focus_sessions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create focus session")
    duration = int(row.get("duration_min") or 0)
    if duration:
        current = int(_load_task_for_user(get_supabase(), task_id, user_id).get("duration_actual_min") or 0)
        get_supabase().table("tasks").update(
            {"duration_actual_min": current + duration, "updated_at": now_iso()}
        ).eq("id", task_id).eq("user_id", user_id).execute()
    return result.data[0]


@router.post("/{task_id}/checklist", status_code=201)
async def add_task_checklist_item(
    task_id: str,
    body: ChecklistItemCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.add_checklist_item(task_id, body, user_id)


@router.get("/filters")
async def get_saved_filters(user_id: str = Depends(get_current_user_id)):
    return list_user_rows("task_saved_filters", user_id, order_by="created_at", desc=True)


@router.post("/filters", status_code=201)
async def create_saved_filter(
    body: SavedFilterCreate,
    user_id: str = Depends(get_current_user_id),
):
    return create_user_row("task_saved_filters", body, user_id, "Failed to create task filter")


@router.get("/analytics")
async def get_task_analytics(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.analytics(user_id, date_from, date_to)


@router.get("/weekly-report")
async def get_weekly_report(
    week_start: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.weekly_report(user_id, week_start)
