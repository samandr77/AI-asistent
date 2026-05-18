from __future__ import annotations
from openai import AsyncOpenAI
from database import get_supabase
from config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

async def _embed(text: str) -> list[float]:
    resp = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=1536,
    )
    return resp.data[0].embedding

async def save_memory(user_id: str, content: str, metadata: dict | None = None) -> str:
    if metadata is None:
        metadata = {}
    embedding = await _embed(content)
    db = get_supabase()
    result = db.table("memory_embeddings").insert({
        "user_id": user_id,
        "content": content,
        "embedding": embedding,
        "metadata": metadata,
    }).execute()
    if not result.data:
        raise RuntimeError("Failed to save memory embedding")
    return result.data[0]["id"]

async def search_relevant_memory(
    user_id: str,
    query: str,
    limit: int = 5,
    threshold: float = 0.7,
) -> list[str]:
    query_embedding = await _embed(query)
    db = get_supabase()
    result = db.rpc("match_memories", {
        "user_id_input": user_id,
        "query_embedding": query_embedding,
        "match_count": limit,
        "match_threshold": threshold,
    }).execute()
    return [row["content"] for row in (result.data or [])]
