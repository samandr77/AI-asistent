from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from database import get_supabase
from models.task import CaptureSource, ParsedDump, ParsedDumpV2, ParsedTaskV2, TaskStatus
from services import task_parser
from services.task_utils import now_iso


def _deadline_with_time(deadline: datetime | None, time_of_day: str | None) -> str | None:
    if deadline is None:
        return None
    if not time_of_day:
        return deadline.isoformat()
    hour, minute = [int(part) for part in time_of_day.split(":", 1)]
    return deadline.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


def task_row_from_parsed(
    task: ParsedTaskV2,
    *,
    user_id: str,
    dump_id: str | None,
    source: CaptureSource = CaptureSource.manual,
) -> dict[str, Any]:
    metadata = {
        "source_text": task.source_text,
        "time_of_day": task.time_of_day,
        "contact": task.contact,
        "url": task.url,
        "clarification_questions": task.clarification_questions,
        "used_parser": "v2",
    }
    return {
        "user_id": user_id,
        "dump_id": dump_id,
        "title": task.title,
        "raw_text": task.source_text,
        "sphere": task.sphere.value if task.sphere else None,
        "priority": int(task.priority),
        "deadline": _deadline_with_time(task.deadline, task.time_of_day),
        "is_today": task.is_today,
        "status": TaskStatus.inbox.value,
        "is_done": False,
        "goal_id": task.goal_id,
        "notes": task.notes,
        "duration_estimated_min": task.duration_estimated_min,
        "source": source.value,
        "parser_metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }


def legacy_task_row(
    task: Any,
    *,
    user_id: str,
    dump_id: str | None,
    raw_text: str,
    source: CaptureSource = CaptureSource.manual,
) -> dict[str, Any]:
    converted = ParsedTaskV2(
        title=task.title,
        source_text=(raw_text or task.title)[:2000],
        sphere=task.sphere,
        priority=task.priority,
        is_today=task.is_today,
        deadline=task.deadline,
        notes=task.notes,
        goal_id=task.goal_id,
    )
    row = task_row_from_parsed(
        converted,
        user_id=user_id,
        dump_id=dump_id,
        source=source,
    )
    row["parser_metadata"]["used_parser"] = "legacy"
    return row


def save_parsed_dump(
    parsed: ParsedDump | ParsedDumpV2,
    user_id: str,
    raw_text: str,
    *,
    source: CaptureSource = CaptureSource.manual,
) -> tuple[str, list[str], list[dict]]:
    db = get_supabase()
    dump_result = (
        db.table("dumps")
        .insert(
            {
                "user_id": user_id,
                "raw_text": raw_text,
                "status": "done",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )
    if not dump_result.data:
        raise HTTPException(status_code=500, detail="Failed to save dump")
    dump_id = dump_result.data[0]["id"]

    if isinstance(parsed, ParsedDumpV2):
        rows = [
            task_row_from_parsed(task, user_id=user_id, dump_id=dump_id, source=source)
            for task in parsed.tasks
        ]
    else:
        rows = [
            legacy_task_row(
                task,
                user_id=user_id,
                dump_id=dump_id,
                raw_text=raw_text,
                source=source,
            )
            for task in parsed.tasks
        ]

    if not rows:
        return dump_id, [], []
    task_result = db.table("tasks").insert(rows).execute()
    if not task_result.data:
        raise HTTPException(status_code=500, detail="Failed to save tasks")
    return dump_id, [row["id"] for row in task_result.data], task_result.data


async def capture_text(
    text: str,
    user_id: str,
    *,
    source: CaptureSource = CaptureSource.manual,
    tier_policy: list[str] | None = None,
) -> dict:
    parsed = await task_parser.parse(text, tier_policy=tier_policy)
    dump_id, task_ids, rows = save_parsed_dump(parsed, user_id, text, source=source)
    today_top3 = [
        row
        for row in sorted(rows, key=lambda item: int(item.get("priority") or 0), reverse=True)
        if row.get("is_today") and not row.get("is_done")
    ][:3]
    return {
        "dump_id": dump_id,
        "tasks": rows,
        "today_top3": today_top3,
        "task_ids": task_ids,
        "used_fallback": parsed.used_fallback,
        "tokens_used": parsed.tokens_used,
    }
