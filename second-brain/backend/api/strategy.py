from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user_id
from database import get_supabase
from models.strategy import StrategyUpdate

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_DEFAULT = {
    "mission": None,
    "vision": None,
    "values": [],
    "life_areas": [],
    "swot_strengths": [],
    "swot_weaknesses": [],
    "swot_opportunities": [],
    "swot_threats": [],
}


@router.get("/")
async def get_strategy(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = db.table("user_strategy").select("*").eq("user_id", user_id).execute()
    if not result.data:
        return {"user_id": user_id, **_DEFAULT}
    return result.data[0]


@router.put("/")
async def update_strategy(
    body: StrategyUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    db = get_supabase()
    existing = db.table("user_strategy").select("user_id").eq("user_id", user_id).execute()
    if existing.data:
        updates["updated_at"] = _now_iso()
        result = (
            db.table("user_strategy")
            .update(updates)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update strategy")
        return result.data[0]

    row = {**_DEFAULT, **updates, "user_id": user_id}
    result = db.table("user_strategy").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create strategy")
    return result.data[0]
