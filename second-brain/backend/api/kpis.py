from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response

from auth import get_current_user_id
from database import get_supabase
from models.kpi import KpiCreate, KpiHistoryEntryCreate, KpiUpdate
from services.kpi_analytics import enrich_kpi

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _assert_owned(rows: list, name: str = "resource") -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=f"{name} not found")
    return rows[0]


@router.get("/")
async def list_kpis(
    is_active: Optional[bool] = None,
    history_limit: int = 12,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    q = db.table("user_kpis").select("*").eq("user_id", user_id)
    if is_active is not None:
        q = q.eq("is_active", is_active)
    kpis = (q.order("created_at", desc=False).execute()).data or []

    enriched = []
    for kpi in kpis:
        history = (
            db.table("user_kpi_history")
            .select("*")
            .eq("kpi_id", kpi["id"])
            .eq("user_id", user_id)
            .order("recorded_on", desc=False)
            .limit(history_limit)
            .execute()
        ).data or []
        enriched.append(enrich_kpi(kpi, history))
    return enriched


@router.get("/{kpi_id}")
async def get_kpi(
    kpi_id: str,
    history_limit: int = 30,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    kpi = _assert_owned(
        db.table("user_kpis").select("*").eq("id", kpi_id).eq("user_id", user_id).execute().data,
        "KPI",
    )
    history = (
        db.table("user_kpi_history")
        .select("*")
        .eq("kpi_id", kpi_id)
        .eq("user_id", user_id)
        .order("recorded_on", desc=False)
        .limit(history_limit)
        .execute()
    ).data or []
    return enrich_kpi(kpi, history)


@router.post("/", status_code=201)
async def create_kpi(
    body: KpiCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    count_result = (
        db.table("user_kpis")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    if (count_result.count or 0) >= 20:
        raise HTTPException(status_code=422, detail="Cannot have more than 20 active KPIs")
    row = body.model_dump(exclude_none=False)
    row["user_id"] = user_id
    result = db.table("user_kpis").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create KPI")
    return enrich_kpi(result.data[0], [])


@router.patch("/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    body: KpiUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    db = get_supabase()
    result = (
        db.table("user_kpis")
        .update(updates)
        .eq("id", kpi_id)
        .eq("user_id", user_id)
        .execute()
    )
    kpi = _assert_owned(result.data, "KPI")
    history = (
        db.table("user_kpi_history")
        .select("*")
        .eq("kpi_id", kpi_id)
        .eq("user_id", user_id)
        .order("recorded_on", desc=False)
        .limit(30)
        .execute()
    ).data or []
    return enrich_kpi(kpi, history)


@router.delete("/{kpi_id}", status_code=204, response_class=Response)
async def delete_kpi(
    kpi_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    db = get_supabase()
    result = (
        db.table("user_kpis")
        .delete()
        .eq("id", kpi_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="KPI not found")
    return Response(status_code=204)


# ── History ─────────────────────────────────────────────────────────────────


@router.post("/{kpi_id}/history", status_code=201)
async def add_kpi_history_entry(
    kpi_id: str,
    body: KpiHistoryEntryCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    _assert_owned(
        db.table("user_kpis").select("id").eq("id", kpi_id).eq("user_id", user_id).execute().data,
        "KPI",
    )
    row = body.model_dump(exclude_none=False)
    row["kpi_id"] = kpi_id
    row["user_id"] = user_id
    if row.get("recorded_on") is None:
        row["recorded_on"] = str(date.today())
    else:
        row["recorded_on"] = str(row["recorded_on"])
    insert_result = db.table("user_kpi_history").insert(row).execute()
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to add history entry")

    # Also bump current_value on the KPI
    db.table("user_kpis").update(
        {"current_value": row["value"], "updated_at": _now_iso()}
    ).eq("id", kpi_id).eq("user_id", user_id).execute()
    return insert_result.data[0]


@router.get("/{kpi_id}/history")
async def list_kpi_history(
    kpi_id: str,
    limit: int = 90,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    _assert_owned(
        db.table("user_kpis").select("id").eq("id", kpi_id).eq("user_id", user_id).execute().data,
        "KPI",
    )
    result = (
        db.table("user_kpi_history")
        .select("*")
        .eq("kpi_id", kpi_id)
        .eq("user_id", user_id)
        .order("recorded_on", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data or []
