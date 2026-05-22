from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response

from auth import get_current_user_id
from database import get_supabase
from models.weekly_review import WeeklyReviewCreate, WeeklyReviewUpdate
from services.okr_progress import aggregate_goal_progress
from services.weekly_review_builder import build_review_draft, iso_week_start

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_week_start(raw: Optional[str]) -> date:
    if not raw or raw == "current":
        return iso_week_start(date.today())
    try:
        ref = date.fromisoformat(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid week date")
    return iso_week_start(ref)


def _assert_owned(rows: list, name: str = "resource") -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=f"{name} not found")
    return rows[0]


@router.get("/weekly/draft")
async def get_weekly_draft(
    week: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    week_start = _parse_week_start(week)
    week_end = week_start + timedelta(days=6)
    db = get_supabase()

    completed = (
        db.table("tasks")
        .select("id,title,sphere,priority,is_done,completed_at,deadline")
        .eq("user_id", user_id)
        .eq("is_done", True)
        .gte("completed_at", week_start.isoformat())
        .lte("completed_at", (week_end + timedelta(days=1)).isoformat())
        .execute()
    ).data or []

    carried = (
        db.table("tasks")
        .select("id,title")
        .eq("user_id", user_id)
        .eq("is_done", False)
        .lte("deadline", week_end.isoformat())
        .execute()
    ).data or []

    goals = (
        db.table("goals")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    ).data or []

    enriched = []
    for goal in goals:
        krs = (
            db.table("goal_key_results")
            .select("*")
            .eq("goal_id", goal["id"])
            .eq("user_id", user_id)
            .execute()
        ).data or []
        tasks = (
            db.table("tasks")
            .select("is_done")
            .eq("goal_id", goal["id"])
            .eq("user_id", user_id)
            .execute()
        ).data or []
        snapshot = aggregate_goal_progress(goal, krs, tasks)
        enriched.append({**goal, **snapshot})

    return build_review_draft(week_start, completed, carried, enriched)


@router.get("/weekly")
async def list_weekly_reviews(
    limit: int = 12,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    result = (
        db.table("weekly_reviews")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


@router.get("/weekly/{week_start_iso}")
async def get_weekly_review(
    week_start_iso: str,
    user_id: str = Depends(get_current_user_id),
):
    week_start = _parse_week_start(week_start_iso)
    db = get_supabase()
    result = (
        db.table("weekly_reviews")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", week_start.isoformat())
        .execute()
    )
    return _assert_owned(result.data, "Weekly review")


@router.post("/weekly", status_code=201)
async def upsert_weekly_review(
    body: WeeklyReviewCreate,
    user_id: str = Depends(get_current_user_id),
):
    week_start = iso_week_start(body.week_start)
    db = get_supabase()
    draft = await get_weekly_draft(week=week_start.isoformat(), user_id=user_id)

    payload = body.model_dump(exclude_none=False)
    payload["user_id"] = user_id
    payload["week_start"] = week_start.isoformat()
    payload["completed_tasks_count"] = draft["completed_tasks_count"]
    payload["carried_over_count"] = draft["carried_over_count"]
    payload["okr_progress"] = {"items": draft["okr_progress"]}

    existing = (
        db.table("weekly_reviews")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_start", payload["week_start"])
        .execute()
    )
    if existing.data:
        payload["updated_at"] = _now_iso()
        result = (
            db.table("weekly_reviews")
            .update(payload)
            .eq("user_id", user_id)
            .eq("week_start", payload["week_start"])
            .execute()
        )
        return _assert_owned(result.data, "Weekly review")

    result = db.table("weekly_reviews").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save weekly review")
    return result.data[0]


@router.patch("/weekly/{week_start_iso}")
async def patch_weekly_review(
    week_start_iso: str,
    body: WeeklyReviewUpdate,
    user_id: str = Depends(get_current_user_id),
):
    week_start = _parse_week_start(week_start_iso)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    db = get_supabase()
    result = (
        db.table("weekly_reviews")
        .update(updates)
        .eq("user_id", user_id)
        .eq("week_start", week_start.isoformat())
        .execute()
    )
    return _assert_owned(result.data, "Weekly review")


@router.delete("/weekly/{week_start_iso}", status_code=204, response_class=Response)
async def delete_weekly_review(
    week_start_iso: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    week_start = _parse_week_start(week_start_iso)
    db = get_supabase()
    result = (
        db.table("weekly_reviews")
        .delete()
        .eq("user_id", user_id)
        .eq("week_start", week_start.isoformat())
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Weekly review not found")
    return Response(status_code=204)
