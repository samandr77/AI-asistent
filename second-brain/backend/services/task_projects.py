from __future__ import annotations

from fastapi import HTTPException

from database import get_supabase
from models.task import ChecklistItemCreate, TaskProjectCreate, TaskProjectUpdate, TaskStatus
from services.task_utils import (
    assert_found,
    create_user_row,
    list_user_rows,
    now_iso,
    payload_from_model,
    update_user_row,
)


def list_projects(user_id: str) -> list[dict]:
    projects = list_user_rows("task_projects", user_id, order_by="created_at", desc=True)
    if not projects:
        return []
    progress = project_progress(user_id, [project["id"] for project in projects])
    for project in projects:
        project.update(progress.get(project["id"], {"progress_percent": 0, "tasks_count": 0, "done_count": 0}))
    return projects


def create_project(body: TaskProjectCreate, user_id: str) -> dict:
    return create_user_row("task_projects", body, user_id, "Failed to create task project")


def update_project(project_id: str, body: TaskProjectUpdate, user_id: str) -> dict:
    return update_user_row("task_projects", project_id, body, user_id, "Task project not found")


def project_progress(user_id: str, project_ids: list[str]) -> dict[str, dict]:
    if not project_ids:
        return {}
    result = (
        get_supabase()
        .table("tasks")
        .select("id,project_id,status,is_done")
        .eq("user_id", user_id)
        .in_("project_id", project_ids)
        .execute()
    )
    progress: dict[str, dict] = {}
    for row in result.data or []:
        project_id = row.get("project_id")
        if not project_id:
            continue
        item = progress.setdefault(project_id, {"tasks_count": 0, "done_count": 0})
        item["tasks_count"] += 1
        if row.get("is_done") or row.get("status") == TaskStatus.done.value:
            item["done_count"] += 1
    for item in progress.values():
        total = item["tasks_count"]
        item["progress_percent"] = round(item["done_count"] / total * 100) if total else 0
    return progress


def add_checklist_item(task_id: str, body: ChecklistItemCreate, user_id: str) -> dict:
    task_result = (
        get_supabase()
        .table("tasks")
        .select("id")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    assert_found(task_result.data or [], "Task not found")
    row = payload_from_model(body)
    row.update({"user_id": user_id, "task_id": task_id, "is_done": False, "created_at": now_iso()})
    result = get_supabase().table("task_checklist_items").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create checklist item")
    return result.data[0]
