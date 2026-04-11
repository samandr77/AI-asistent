from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user_id
from database import get_supabase

router = APIRouter()

@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = db.table("user_profiles").select("*").eq("id", user_id).execute()
    profile = result.data[0] if result.data else None
    return {"id": user_id, "profile": profile}

@router.post("/profile")
async def upsert_profile(body: dict, user_id: str = Depends(get_current_user_id)):
    body["id"] = user_id
    db = get_supabase()
    result = db.table("user_profiles").upsert(body).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Upsert returned no data")
    return result.data[0]
