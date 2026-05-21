from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from database import get_supabase
from models.task import SavedFilterCreate, SavedFilterUpdate, TaskSearchFilters, TaskStatus
from services.task_utils import assert_found, now_iso, payload_from_model


BUILT_IN_FILTERS: dict[str, dict[str, Any]] = {
    "overdue": {"overdue": True},
    "no_date": {"no_date": True},
    "high_priority": {"priority": 3},
    "inbox": {"status": TaskStatus.inbox.value},
    "delegated": {"status": TaskStatus.delegated.value},
    "deep_work": {"deep_work": True},
    "projectless": {"projectless": True},
    "recurring": {"recurring": True},
    "habits": {"habit_mode": True},
}


def _apply_query(query, filters: dict[str, Any]):
    today = datetime.now(timezone.utc).isoformat()
    for key in ("status", "sphere", "project_id", "context", "priority", "deep_work", "habit_mode"):
        value = filters.get(key)
        if value is not None:
            query = query.eq(key, value.value if hasattr(value, "value") else value)
    if filters.get("deadline_from"):
        query = query.gte("deadline", filters["deadline_from"].isoformat())
    if filters.get("deadline_to"):
        query = query.lte("deadline", filters["deadline_to"].isoformat())
    if filters.get("scheduled_from"):
        query = query.gte("scheduled_start", filters["scheduled_from"].isoformat())
    if filters.get("scheduled_to"):
        query = query.lte("scheduled_start", filters["scheduled_to"].isoformat())
    if filters.get("overdue"):
        query = query.lt("deadline", today).eq("is_done", False)
    if filters.get("no_date"):
        query = query.is_("deadline", None)
    if filters.get("projectless"):
        query = query.is_("project_id", None)
    if filters.get("recurring"):
        query = query.not_.is_("recurrence_rule", None)
    tags = filters.get("tags") or []
    if tags and hasattr(query, "contains"):
        query = query.contains("tags", tags)
    return query


def search_tasks(user_id: str, body: TaskSearchFilters) -> list[dict]:
    filters = payload_from_model(body)
    query = get_supabase().table("tasks").select("*").eq("user_id", user_id)
    query = _apply_query(query, filters)
    result = (
        query.order("created_at", desc=True)
        .range(body.offset, body.offset + body.limit - 1)
        .execute()
    )
    return result.data or []


def create_filter(body: SavedFilterCreate, user_id: str) -> dict:
    row = payload_from_model(body)
    row.update({"user_id": user_id, "created_at": now_iso(), "updated_at": now_iso()})
    result = get_supabase().table("task_saved_filters").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task filter")
    return result.data[0]


def update_filter(filter_id: str, body: SavedFilterUpdate, user_id: str) -> dict:
    updates = payload_from_model(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = (
        get_supabase()
        .table("task_saved_filters")
        .update(updates)
        .eq("id", filter_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], "Task filter not found")


def delete_filter(filter_id: str, user_id: str) -> None:
    result = (
        get_supabase()
        .table("task_saved_filters")
        .delete()
        .eq("id", filter_id)
        .eq("user_id", user_id)
        .execute()
    )
    assert_found(result.data or [], "Task filter not found")


def apply_filter(filter_id: str, user_id: str) -> dict:
    definition: dict[str, Any]
    if filter_id in BUILT_IN_FILTERS:
        definition = BUILT_IN_FILTERS[filter_id]
        name = filter_id
    else:
        result = (
            get_supabase()
            .table("task_saved_filters")
            .select("*")
            .eq("id", filter_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = assert_found(result.data or [], "Task filter not found")
        definition = row.get("definition") or {}
        name = row.get("name") or filter_id
    query = get_supabase().table("tasks").select("*").eq("user_id", user_id)
    query = _apply_query(query, definition)
    rows = query.order("created_at", desc=True).execute().data or []
    return {"id": filter_id, "name": name, "definition": definition, "tasks": rows}
