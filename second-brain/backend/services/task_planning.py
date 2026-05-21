from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException

from database import get_supabase
from models.task import BigThreeRequest, EisenhowerQuadrant, TaskStatus, TimeBlockCreate
from services.task_utils import load_task_for_user, now_iso, payload_from_model


def infer_eisenhower_quadrant(task: dict) -> str:
    if task.get("eisenhower_quadrant"):
        return task["eisenhower_quadrant"]
    priority = int(task.get("priority") or 2)
    deadline_raw = task.get("deadline")
    urgent = bool(task.get("is_today"))
    if deadline_raw:
        try:
            deadline = datetime.fromisoformat(str(deadline_raw).replace("Z", "+00:00"))
            urgent = urgent or deadline <= datetime.now(timezone.utc) + timedelta(days=1)
        except ValueError:
            urgent = urgent or str(deadline_raw) <= date.today().isoformat()
    important = priority >= 3 or bool(task.get("goal_id"))
    if urgent and important:
        return EisenhowerQuadrant.do_now.value
    if important:
        return EisenhowerQuadrant.schedule.value
    if urgent:
        return EisenhowerQuadrant.delegate.value
    return EisenhowerQuadrant.delete.value


def get_matrix(user_id: str) -> dict[str, list[dict]]:
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_done", False)
        .neq("status", TaskStatus.archived.value)
        .execute()
    )
    matrix: dict[str, list[dict]] = defaultdict(list)
    for task in result.data or []:
        matrix[infer_eisenhower_quadrant(task)].append(task)
    return {quadrant.value: matrix.get(quadrant.value, []) for quadrant in EisenhowerQuadrant}


def get_big_three(user_id: str, target_date: date) -> dict:
    result = (
        get_supabase()
        .table("task_big_three")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", target_date.isoformat())
        .order("position", desc=False)
        .execute()
    )
    return {"date": target_date.isoformat(), "items": result.data or []}


def set_big_three(user_id: str, body: BigThreeRequest) -> dict:
    if len(set(body.task_ids)) != len(body.task_ids):
        raise HTTPException(status_code=422, detail="task_ids must be unique")
    if len(body.task_ids) > 3:
        raise HTTPException(status_code=422, detail="Big Three cannot exceed 3 tasks")

    db = get_supabase()
    for task_id in body.task_ids:
        load_task_for_user(task_id, user_id)

    db.table("task_big_three").delete().eq("user_id", user_id).eq(
        "date", body.date.isoformat()
    ).execute()
    rows = [
        {
            "user_id": user_id,
            "date": body.date.isoformat(),
            "task_id": task_id,
            "position": index + 1,
            "created_at": now_iso(),
        }
        for index, task_id in enumerate(body.task_ids)
    ]
    inserted: list[dict] = []
    if rows:
        result = db.table("task_big_three").insert(rows).execute()
        inserted = result.data or []
    return {"date": body.date.isoformat(), "items": inserted}


def get_time_blocks(user_id: str, target_date: date | None = None) -> list[dict]:
    query = get_supabase().table("tasks").select("*").eq("user_id", user_id)
    if target_date:
        start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        query = query.gte("scheduled_start", start.isoformat()).lt(
            "scheduled_start", end.isoformat()
        )
    result = query.order("scheduled_start", desc=False).execute()
    return result.data or []


def create_time_block(user_id: str, body: TimeBlockCreate) -> dict:
    if body.scheduled_end <= body.scheduled_start:
        raise HTTPException(status_code=422, detail="scheduled_end must be after scheduled_start")
    load_task_for_user(body.task_id, user_id)
    updates = payload_from_model(body, partial=True)
    updates.pop("task_id", None)
    updates["is_today"] = True
    updates["status"] = TaskStatus.active.value
    updates["updated_at"] = now_iso()
    result = (
        get_supabase()
        .table("tasks")
        .update(updates)
        .eq("id", body.task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]
