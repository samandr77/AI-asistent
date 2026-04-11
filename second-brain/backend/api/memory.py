from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import get_current_user_id
from database import get_supabase
from services.memory_store import search_relevant_memory

router = APIRouter()

class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 5

@router.post("/search")
async def search_memory(body: MemorySearchRequest, user_id: str = Depends(get_current_user_id)):
    results = await search_relevant_memory(user_id, body.query, body.limit)
    return {"results": results}

@router.get("/profile")
async def get_memory_profile(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("memory_embeddings")
        .select("id, content, metadata, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data
