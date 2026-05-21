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


def get_project(project_id: str, user_id: str) -> dict:
    result = (
        get_supabase()
        .table("task_projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    project = assert_found(result.data or [], "Task project not found")
    project.update(project_progress(user_id, [project_id]).get(project_id, {"progress_percent": 0, "tasks_count": 0, "done_count": 0}))
    return project


def list_project_tasks(project_id: str, user_id: str) -> list[dict]:
    get_project(project_id, user_id)
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def add_task_to_project(project_id: str, task_id: str, user_id: str) -> dict:
    get_project(project_id, user_id)
    result = (
        get_supabase()
        .table("tasks")
        .update({"project_id": project_id, "updated_at": now_iso()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")


def remove_task_from_project(project_id: str, task_id: str, user_id: str) -> dict:
    get_project(project_id, user_id)
    result = (
        get_supabase()
        .table("tasks")
        .update({"project_id": None, "updated_at": now_iso()})
        .eq("id", task_id)
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task not found in project")


def archive_project(project_id: str, user_id: str) -> dict:
    body = TaskProjectUpdate(status="archived")
    return update_project(project_id, body, user_id)


def delete_project(project_id: str, user_id: str) -> None:
    get_project(project_id, user_id)
    get_supabase().table("tasks").update({"project_id": None, "updated_at": now_iso()}).eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()
    result = (
        get_supabase()
        .table("task_projects")
        .delete()
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Task project not found")


def create_template(body: TaskProjectCreate, user_id: str) -> dict:
    row = payload_from_model(body)
    row.update({"user_id": user_id, "created_at": now_iso(), "updated_at": now_iso()})
    result = get_supabase().table("task_project_templates").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task project template")
    return result.data[0]


def create_from_template(template_id: str, user_id: str) -> dict:
    result = (
        get_supabase()
        .table("task_project_templates")
        .select("*")
        .eq("id", template_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    template = assert_found(result.data or [], "Task project template not found")
    body = TaskProjectCreate(
        title=template["title"],
        description=template.get("description"),
        goal_id=template.get("goal_id"),
        deadline=template.get("deadline"),
    )
    return create_project(body, user_id)


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
