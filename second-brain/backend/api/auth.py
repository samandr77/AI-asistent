from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from auth import get_current_user_id, get_current_user, CurrentUser
from database import get_supabase

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
    result = db.table("user_profiles").select("*").eq("id", user.id).execute()
    profile = result.data[0] if result.data else None
    return {"id": user.id, "provider": user.provider, "profile": profile}

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
