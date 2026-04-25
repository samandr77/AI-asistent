from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from auth import get_current_user_id, get_current_user, CurrentUser
from database import get_supabase
from models.account import AccountDeletionResponse
from services.account_cleanup import (
    AlreadyDeleted,
    UserNotFound,
    scheduled_purge_at,
    soft_delete_user,
)

router = APIRouter()


class ProfileUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    language: Optional[str] = None
    role: Optional[str] = None
    living_with: Optional[str] = None
    peak_hours: Optional[str] = None
    is_onboarded: Optional[bool] = None


@router.get("/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    # Use service-role query so we can see deleted_at (RLS for the user hides
    # soft-deleted rows entirely). We scope by the caller's id.
    result = (
        db.table("user_profiles")
        .select("*")
        .eq("id", user.id)
        .execute()
    )
    row = result.data[0] if result.data else None

    if row and row.get("deleted_at"):
        scheduled_for = scheduled_purge_at(
            _parse_ts(row["deleted_at"])
        ).isoformat()
        return JSONResponse(
            status_code=410,
            content={
                "error": "account_pending_deletion",
                "scheduled_for": scheduled_for,
            },
        )

    return {"id": user.id, "provider": user.provider, "profile": row}


@router.post("/profile")
async def upsert_profile(
    body: ProfileUpsertRequest,
    user_id: str = Depends(get_current_user_id),
):
    payload = body.model_dump(exclude_unset=True)
    payload["id"] = user_id
    db = get_supabase()
    result = db.table("user_profiles").upsert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Upsert returned no data")
    return result.data[0]


@router.delete("/account", response_model=AccountDeletionResponse)
async def delete_account(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    try:
        deleted_at = soft_delete_user(db, user_id)
    except AlreadyDeleted as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "account_already_deleted",
                "scheduled_for": scheduled_purge_at(
                    _parse_ts(exc.deleted_at)
                ).isoformat(),
            },
        )
    except UserNotFound:
        raise HTTPException(status_code=404, detail="Profile not found")

    return AccountDeletionResponse(
        status="scheduled",
        scheduled_for=scheduled_purge_at(deleted_at),
    )


def _parse_ts(value: Union[str, datetime]) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    # Supabase returns ISO with optional 'Z' or '+00:00'
    cleaned = value.replace("Z", "+00:00") if value.endswith("Z") else value
    return datetime.fromisoformat(cleaned)
