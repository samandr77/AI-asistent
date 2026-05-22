from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from auth import get_current_user_id
from database import get_supabase
from models.task import (
    AIPlanningRequest,
    AttachmentCreate,
    AttachmentUpdate,
    BigThreeRequest,
    CaptureSource,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistReorder,
    CommentCreate,
    CommentUpdate,
    CaptureIntegrationRequest,
    DependencyCreate,
    FocusSessionCreate,
    FocusSessionUpdate,
    FocusSettingsUpdate,
    RecurrenceUpdate,
    SavedFilterCreate,
    SavedFilterUpdate,
    TaskBulkUpdate,
    TaskCaptureRequest,
    TaskCreate,
    TaskProcessAction,
    TaskProcessType,
    TaskSearchFilters,
    TaskStatus,
    TimeBlockCreate,
)
from services.premium import get_ai_tier_policy, get_history_cutoff, get_user_premium
from services import (
    ai_budget,
    task_calendar,
    task_ai_planning,
    task_analytics,
    task_capture,
    task_filters,
    task_focus,
    task_planning,
    task_projects,
    task_recurrence,
    task_relations,
)
from services.task_utils import list_user_rows, now_iso

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
    assignee_name: Optional[str] = None
    assignee_contact: Optional[str] = None
    delegation_status: Optional[str] = None


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


@router.get("/search")
async def search_tasks(
    status: TaskStatus | None = None,
    sphere: str | None = None,
    project_id: str | None = None,
    context: str | None = None,
    priority: int | None = None,
    deep_work: bool | None = None,
    habit_mode: bool | None = None,
    overdue: bool = False,
    no_date: bool = False,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    filters = TaskSearchFilters(
        status=status,
        sphere=sphere,
        project_id=project_id,
        context=context,
        priority=priority,
        deep_work=deep_work,
        habit_mode=habit_mode,
        overdue=overdue,
        no_date=no_date,
        limit=limit,
        offset=offset,
    )
    return task_filters.search_tasks(user_id, filters)


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
        "assignee_name": body.assignee_name,
        "assignee_contact": body.assignee_contact,
        "delegation_status": body.delegation_status,
        "created_at": now,
        "updated_at": now,
    }
    db = get_supabase()
    result = db.table("tasks").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return result.data[0]


@router.post("/bulk-update")
async def bulk_update_tasks(
    body: TaskBulkUpdate,
    user_id: str = Depends(get_current_user_id),
):
    if len(set(body.task_ids)) != len(body.task_ids):
        raise HTTPException(status_code=422, detail="task_ids must be unique")
    for task_id in body.task_ids:
        _load_task_for_user(get_supabase(), task_id, user_id)
    updates = body.model_dump(exclude_unset=True, exclude={"task_ids"})
    _serialize_task_updates(updates)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = (
        get_supabase()
        .table("tasks")
        .update(updates)
        .eq("user_id", user_id)
        .in_("id", body.task_ids)
        .execute()
    )
    return {"updated": result.data or []}


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    _serialize_task_updates(updates)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
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


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    return task_recurrence.complete_recurring_task(task_id, user_id)


@router.post("/{task_id}/archive")
async def archive_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = (
        get_supabase()
        .table("tasks")
        .update({"status": TaskStatus.archived.value, "is_done": False, "updated_at": now_iso()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]


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


def _serialize_task_updates(updates: dict) -> dict:
    _normalize_status_is_done(updates)
    for key in ("deadline", "reminder_at", "scheduled_start", "scheduled_end", "next_occurrence_at"):
        if key in updates and updates[key] is not None and hasattr(updates[key], "isoformat"):
            updates[key] = updates[key].isoformat()
    for key, value in list(updates.items()):
        if hasattr(value, "value"):
            updates[key] = value.value
    return updates


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
        db.table("tasks").update(
            {"status": TaskStatus.archived.value, "is_done": False, "updated_at": now_iso()}
        ).eq("id", task_id).eq("user_id", user_id).execute()
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
            updates["assignee_name"] = body.delegate_to
            updates["assignee_contact"] = body.delegate_contact
            updates["delegated_at"] = now_iso()
            updates["delegation_status"] = "delegated"
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


async def _capture_integration(
    body: CaptureIntegrationRequest,
    source,
    user_id: str,
):
    premium = await get_user_premium(user_id)
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=429, detail="Daily AI budget exceeded")
    result = await task_capture.capture_text(
        body.text,
        user_id,
        source=source,
        tier_policy=get_ai_tier_policy(premium),
    )
    for task in result.get("tasks", []):
        task.setdefault("parser_metadata", {}).update(
            {"external_id": body.external_id, **body.metadata}
        )
    await ai_budget.record_usage(user_id, result.get("tokens_used", 0))
    return result


@router.post("/capture/telegram", status_code=201)
async def capture_task_telegram(body: CaptureIntegrationRequest, user_id: str = Depends(get_current_user_id)):
    return await _capture_integration(body, CaptureSource.telegram, user_id)


@router.post("/capture/voice", status_code=201)
async def capture_task_voice(body: CaptureIntegrationRequest, user_id: str = Depends(get_current_user_id)):
    return await _capture_integration(body, CaptureSource.voice, user_id)


@router.post("/capture/browser", status_code=201)
async def capture_task_browser(body: CaptureIntegrationRequest, user_id: str = Depends(get_current_user_id)):
    return await _capture_integration(body, CaptureSource.browser, user_id)


@router.post("/capture/email", status_code=201)
async def capture_task_email(body: CaptureIntegrationRequest, user_id: str = Depends(get_current_user_id)):
    return await _capture_integration(body, CaptureSource.email, user_id)


@router.post("/capture/import", status_code=201)
async def capture_task_import(body: CaptureIntegrationRequest, user_id: str = Depends(get_current_user_id)):
    return await _capture_integration(body, CaptureSource.manual, user_id)


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


@router.patch("/time-blocks/{task_id}")
async def update_time_block(
    task_id: str,
    body: TimeBlockCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.update_time_block(user_id, task_id, body)


@router.delete("/time-blocks/{task_id}", status_code=204, response_class=Response)
async def delete_time_block(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_planning.delete_time_block(user_id, task_id)
    return Response(status_code=204)


@router.get("/time-blocks/capacity")
async def get_time_block_capacity(
    target_date: date,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.capacity(user_id, target_date)


@router.get("/time-blocks/free-slots")
async def get_time_block_free_slots(
    target_date: date,
    user_id: str = Depends(get_current_user_id),
):
    return task_planning.free_slots(user_id, target_date)


@router.get("/calendar")
async def get_task_calendar(
    start_date: date,
    days: int = 7,
    user_id: str = Depends(get_current_user_id),
):
    return task_calendar.calendar(user_id, start_date, days)


@router.get("/reminders/due")
async def get_due_task_reminders(
    now: datetime | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_calendar.due_reminders(user_id, now)


@router.post("/{task_id}/reminders/sent")
async def mark_task_reminder_sent(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    return task_calendar.mark_reminder_sent(task_id, user_id)


@router.post("/{task_id}/focus-sessions", status_code=201)
async def create_focus_session(
    task_id: str,
    body: FocusSessionCreate,
    user_id: str = Depends(get_current_user_id),
):
    task_focus.get_supabase = get_supabase
    return task_focus.create_session(task_id, body, user_id)


@router.get("/{task_id}/focus-sessions")
async def list_task_focus_sessions(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    return task_focus.list_task_sessions(task_id, user_id)


@router.get("/focus-sessions")
async def list_focus_sessions(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_focus.list_sessions(user_id, date_from, date_to)


@router.patch("/focus-sessions/{session_id}")
async def update_focus_session(
    session_id: str,
    body: FocusSessionUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_focus.update_session(session_id, body, user_id)


@router.delete("/focus-sessions/{session_id}", status_code=204, response_class=Response)
async def delete_focus_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_focus.delete_session(session_id, user_id)
    return Response(status_code=204)


@router.get("/focus-summary")
async def get_focus_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_focus.summary(user_id, date_from, date_to)


@router.get("/focus-settings")
async def get_focus_settings(user_id: str = Depends(get_current_user_id)):
    return task_focus.get_settings(user_id)


@router.put("/focus-settings")
async def put_focus_settings(
    body: FocusSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_focus.put_settings(body, user_id)


@router.post("/{task_id}/checklist", status_code=201)
async def add_task_checklist_item(
    task_id: str,
    body: ChecklistItemCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.add_checklist_item(task_id, body, user_id)


@router.get("/{task_id}/checklist")
async def list_task_checklist(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_relations.list_checklist(task_id, user_id)


@router.patch("/{task_id}/checklist/{item_id}")
async def update_task_checklist_item(
    task_id: str,
    item_id: str,
    body: ChecklistItemUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.update_checklist_item(task_id, item_id, body, user_id)


@router.delete("/{task_id}/checklist/{item_id}", status_code=204, response_class=Response)
async def delete_task_checklist_item(
    task_id: str,
    item_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_relations.delete_checklist_item(task_id, item_id, user_id)
    return Response(status_code=204)


@router.post("/{task_id}/checklist/reorder")
async def reorder_task_checklist(
    task_id: str,
    body: ChecklistReorder,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.reorder_checklist(task_id, body, user_id)


@router.get("/filters")
async def get_saved_filters(user_id: str = Depends(get_current_user_id)):
    return list_user_rows("task_saved_filters", user_id, order_by="created_at", desc=True)


@router.post("/filters", status_code=201)
async def create_saved_filter(
    body: SavedFilterCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_filters.create_filter(body, user_id)


@router.patch("/filters/{filter_id}")
async def update_saved_filter(
    filter_id: str,
    body: SavedFilterUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_filters.update_filter(filter_id, body, user_id)


@router.delete("/filters/{filter_id}", status_code=204, response_class=Response)
async def delete_saved_filter(
    filter_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_filters.delete_filter(filter_id, user_id)
    return Response(status_code=204)


@router.post("/filters/{filter_id}/apply")
async def apply_saved_filter(
    filter_id: str,
    user_id: str = Depends(get_current_user_id),
):
    return task_filters.apply_filter(filter_id, user_id)


@router.get("/analytics")
async def get_task_analytics(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.analytics(user_id, date_from, date_to)


@router.get("/analytics/summary")
async def get_task_analytics_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.analytics(user_id, date_from, date_to)


@router.get("/analytics/estimate-vs-actual")
async def get_estimate_vs_actual(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.estimate_vs_actual(user_id, date_from, date_to)


@router.get("/analytics/by-weekday")
async def get_analytics_by_weekday(
    date_from: date | None = None,
    date_to: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.by_weekday(user_id, date_from, date_to)


@router.get("/analytics/rollover-patterns")
async def get_rollover_patterns(user_id: str = Depends(get_current_user_id)):
    return task_analytics.rollover_patterns(user_id)


@router.get("/analytics/projects")
async def get_project_analytics(user_id: str = Depends(get_current_user_id)):
    return task_analytics.project_analytics(user_id)


@router.get("/weekly-report")
async def get_weekly_report(
    week_start: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.weekly_report(user_id, week_start)


@router.post("/weekly-report/generate")
async def generate_weekly_report(
    week_start: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return task_analytics.generate_weekly_report(user_id, week_start)


@router.get("/habits")
async def list_habits(user_id: str = Depends(get_current_user_id)):
    return task_recurrence.list_habits(user_id)


@router.get("/habits/{task_id}/stats")
async def get_habit_stats(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_recurrence.habit_stats(task_id, user_id)


@router.get("/habits/{task_id}/history")
async def get_habit_history(
    task_id: str,
    days: int = 30,
    user_id: str = Depends(get_current_user_id),
):
    return task_recurrence.habit_history(task_id, user_id, days)


@router.post("/recurrence/run-due")
async def run_due_recurrence(
    target_date: date | None = None,
    user_id: str = Depends(get_current_user_id),
):
    return {"tasks": task_recurrence.rollover_due_recurring(user_id, target_date)}


@router.get("/{task_id}/recurrence")
async def get_task_recurrence(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_recurrence.get_recurrence(task_id, user_id)


@router.put("/{task_id}/recurrence")
async def put_task_recurrence(
    task_id: str,
    body: RecurrenceUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_recurrence.put_recurrence(task_id, body, user_id)


@router.delete("/{task_id}/recurrence", status_code=204, response_class=Response)
async def delete_task_recurrence(task_id: str, user_id: str = Depends(get_current_user_id)):
    task_recurrence.delete_recurrence(task_id, user_id)
    return Response(status_code=204)


@router.post("/{task_id}/rollover")
async def rollover_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_recurrence.rollover_task(task_id, user_id)


@router.get("/{task_id}/dependencies")
async def list_dependencies(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_relations.list_dependencies(task_id, user_id)


@router.post("/{task_id}/dependencies", status_code=201)
async def create_dependency(
    task_id: str,
    body: DependencyCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.create_dependency(task_id, body, user_id)


@router.delete("/{task_id}/dependencies/{dependency_id}", status_code=204, response_class=Response)
async def delete_dependency(
    task_id: str,
    dependency_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_relations.delete_dependency(task_id, dependency_id, user_id)
    return Response(status_code=204)


@router.get("/{task_id}/comments")
async def list_comments(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_relations.list_comments(task_id, user_id)


@router.post("/{task_id}/comments", status_code=201)
async def create_comment(
    task_id: str,
    body: CommentCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.create_comment(task_id, body, user_id)


@router.patch("/{task_id}/comments/{comment_id}")
async def update_comment(
    task_id: str,
    comment_id: str,
    body: CommentUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.update_comment(task_id, comment_id, body, user_id)


@router.delete("/{task_id}/comments/{comment_id}", status_code=204, response_class=Response)
async def delete_comment(
    task_id: str,
    comment_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_relations.delete_comment(task_id, comment_id, user_id)
    return Response(status_code=204)


@router.get("/{task_id}/attachments")
async def list_attachments(task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_relations.list_attachments(task_id, user_id)


@router.post("/{task_id}/attachments", status_code=201)
async def create_attachment(
    task_id: str,
    body: AttachmentCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.create_attachment(task_id, body, user_id)


@router.patch("/{task_id}/attachments/{attachment_id}")
async def update_attachment(
    task_id: str,
    attachment_id: str,
    body: AttachmentUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_relations.update_attachment(task_id, attachment_id, body, user_id)


@router.delete("/{task_id}/attachments/{attachment_id}", status_code=204, response_class=Response)
async def delete_attachment(
    task_id: str,
    attachment_id: str,
    user_id: str = Depends(get_current_user_id),
):
    task_relations.delete_attachment(task_id, attachment_id, user_id)
    return Response(status_code=204)


async def _run_ai_endpoint(action: str, body: AIPlanningRequest, user_id: str):
    premium = await get_user_premium(user_id)
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=429, detail="Daily AI budget exceeded")
    result = await task_ai_planning.run(action, body, user_id, get_ai_tier_policy(premium))
    await ai_budget.record_usage(user_id, result.get("tokens_used", 0))
    return result


@router.post("/ai/suggest")
async def ai_suggest(body: AIPlanningRequest, user_id: str = Depends(get_current_user_id)):
    return await _run_ai_endpoint("suggest", body, user_id)


@router.post("/ai/split")
async def ai_split(body: AIPlanningRequest, user_id: str = Depends(get_current_user_id)):
    return await _run_ai_endpoint("split", body, user_id)


@router.post("/ai/plan-day")
async def ai_plan_day(body: AIPlanningRequest, user_id: str = Depends(get_current_user_id)):
    return await _run_ai_endpoint("plan_day", body, user_id)


@router.post("/ai/deadline-risk")
async def ai_deadline_risk(body: AIPlanningRequest, user_id: str = Depends(get_current_user_id)):
    return await _run_ai_endpoint("deadline_risk", body, user_id)


@router.post("/ai/process-inbox")
async def ai_process_inbox(body: AIPlanningRequest, user_id: str = Depends(get_current_user_id)):
    return await _run_ai_endpoint("process_inbox", body, user_id)


@router.get("/{task_id}")
async def get_task_detail(task_id: str, user_id: str = Depends(get_current_user_id)):
    return _load_task_for_user(get_supabase(), task_id, user_id)
