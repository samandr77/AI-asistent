from __future__ import annotations

from fastapi import HTTPException

from database import get_supabase
from models.task import (
    AttachmentCreate,
    AttachmentUpdate,
    ChecklistItemUpdate,
    ChecklistReorder,
    CommentCreate,
    CommentUpdate,
    DependencyCreate,
)
from services.task_utils import (
    assert_found,
    load_task_for_user,
    now_iso,
    payload_from_model,
)


def _load_user_row(table: str, row_id: str, user_id: str, detail: str) -> dict:
    result = (
        get_supabase()
        .table(table)
        .select("*")
        .eq("id", row_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return assert_found(result.data or [], detail)


def list_checklist(task_id: str, user_id: str) -> list[dict]:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_checklist_items")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .order("position", desc=False)
        .execute()
    )
    return result.data or []


def update_checklist_item(task_id: str, item_id: str, body: ChecklistItemUpdate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    updates = payload_from_model(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = (
        get_supabase()
        .table("task_checklist_items")
        .update(updates)
        .eq("id", item_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Checklist item not found")


def delete_checklist_item(task_id: str, item_id: str, user_id: str) -> None:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_checklist_items")
        .delete()
        .eq("id", item_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Checklist item not found")


def reorder_checklist(task_id: str, body: ChecklistReorder, user_id: str) -> dict:
    existing = list_checklist(task_id, user_id)
    existing_ids = {row["id"] for row in existing}
    if any(item_id not in existing_ids for item_id in body.item_ids):
        raise HTTPException(status_code=422, detail="Unknown checklist item id")
    updated: list[dict] = []
    for position, item_id in enumerate(body.item_ids):
        result = (
            get_supabase()
            .table("task_checklist_items")
            .update({"position": position, "updated_at": now_iso()})
            .eq("id", item_id)
            .eq("task_id", task_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            updated.append(result.data[0])
    return {"items": updated}


def _dependency_edges(user_id: str) -> list[dict]:
    result = (
        get_supabase()
        .table("task_dependencies")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


def _has_path(edges: list[dict], start: str, target: str) -> bool:
    graph: dict[str, list[str]] = {}
    for edge in edges:
        graph.setdefault(edge["task_id"], []).append(edge["depends_on_task_id"])
    stack = [start]
    seen: set[str] = set()
    while stack:
        node = stack.pop()
        if node == target:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph.get(node, []))
    return False


def list_dependencies(task_id: str, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_dependencies")
        .select("*")
        .eq("user_id", user_id)
        .eq("task_id", task_id)
        .execute()
    )
    blockers = (
        get_supabase()
        .table("task_dependencies")
        .select("*")
        .eq("user_id", user_id)
        .eq("depends_on_task_id", task_id)
        .execute()
    )
    return {"dependencies": result.data or [], "blocked_tasks": blockers.data or []}


def create_dependency(task_id: str, body: DependencyCreate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    load_task_for_user(body.depends_on_task_id, user_id)
    if task_id == body.depends_on_task_id:
        raise HTTPException(status_code=422, detail="Task cannot depend on itself")
    edges = _dependency_edges(user_id)
    if _has_path(edges, body.depends_on_task_id, task_id):
        raise HTTPException(status_code=422, detail="Dependency cycle detected")
    row = {
        "user_id": user_id,
        "task_id": task_id,
        "depends_on_task_id": body.depends_on_task_id,
        "created_at": now_iso(),
    }
    result = get_supabase().table("task_dependencies").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task dependency")
    return result.data[0]


def delete_dependency(task_id: str, dependency_id: str, user_id: str) -> None:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_dependencies")
        .delete()
        .eq("id", dependency_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Dependency not found")


def list_comments(task_id: str, user_id: str) -> list[dict]:
    load_task_for_user(task_id, user_id)
    return (
        get_supabase()
        .table("task_comments")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def create_comment(task_id: str, body: CommentCreate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    row = payload_from_model(body)
    row.update({"user_id": user_id, "task_id": task_id, "created_at": now_iso()})
    result = get_supabase().table("task_comments").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task comment")
    return result.data[0]


def update_comment(task_id: str, comment_id: str, body: CommentUpdate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_comments")
        .update({"body": body.body, "updated_at": now_iso()})
        .eq("id", comment_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Comment not found")


def delete_comment(task_id: str, comment_id: str, user_id: str) -> None:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_comments")
        .delete()
        .eq("id", comment_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Comment not found")


def list_attachments(task_id: str, user_id: str) -> list[dict]:
    load_task_for_user(task_id, user_id)
    return (
        get_supabase()
        .table("task_attachments")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def create_attachment(task_id: str, body: AttachmentCreate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    row = payload_from_model(body)
    row.update({"user_id": user_id, "task_id": task_id, "created_at": now_iso()})
    result = get_supabase().table("task_attachments").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task attachment")
    return result.data[0]


def update_attachment(task_id: str, attachment_id: str, body: AttachmentUpdate, user_id: str) -> dict:
    load_task_for_user(task_id, user_id)
    updates = payload_from_model(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    result = (
        get_supabase()
        .table("task_attachments")
        .update(updates)
        .eq("id", attachment_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Attachment not found")


def delete_attachment(task_id: str, attachment_id: str, user_id: str) -> None:
    load_task_for_user(task_id, user_id)
    result = (
        get_supabase()
        .table("task_attachments")
        .delete()
        .eq("id", attachment_id)
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Attachment not found")
