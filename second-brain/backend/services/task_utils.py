from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from fastapi import HTTPException

from database import get_supabase


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def payload_from_model(body: Any, *, partial: bool = False) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=partial)
    return {key: serialize_value(value) for key, value in data.items()}


def assert_found(rows: list[dict] | None, detail: str) -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=detail)
    return rows[0]


def list_user_rows(
    table: str,
    user_id: str,
    *,
    order_by: str = "created_at",
    desc: bool = True,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict]:
    query = (
        get_supabase()
        .table(table)
        .select("*")
        .eq("user_id", user_id)
        .order(order_by, desc=desc)
    )
    if limit is not None:
        query = query.range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


def create_user_row(table: str, body: Any, user_id: str, detail: str) -> dict:
    row = payload_from_model(body)
    row["user_id"] = user_id
    result = get_supabase().table(table).insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail=detail)
    return result.data[0]


def update_user_row(
    table: str,
    row_id: str,
    body: Any,
    user_id: str,
    detail: str,
) -> dict:
    updates = payload_from_model(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = now_iso()
    result = (
        get_supabase()
        .table(table)
        .update(updates)
        .eq("id", row_id)
        .eq("user_id", user_id)
        .execute()
    )
    return assert_found(result.data or [], detail)


def load_task_for_user(task_id: str, user_id: str) -> dict:
    result = (
        get_supabase()
        .table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return assert_found(result.data or [], "Task not found")
