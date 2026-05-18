"""Per-user daily AI token accounting.

has_budget() — read-only check before initiating an AI call.
record_usage() — RPC-backed atomic increment after the call completes.

Budget is a soft cap: when exhausted, callers should refuse to dispatch the
request rather than silently retrying, because token spend has direct $ cost.
"""
from datetime import datetime, timezone

from config import settings
from database import get_supabase


async def has_budget(user_id: str) -> bool:
    """Return True if user still has tokens for today, or if gating is off."""
    if settings.daily_user_token_budget <= 0:
        return True
    db = get_supabase()
    today = datetime.now(timezone.utc).date().isoformat()
    resp = (
        db.table("user_ai_usage")
        .select("total_tokens")
        .eq("user_id", user_id)
        .eq("usage_date", today)
        .maybe_single()
        .execute()
    )
    data = getattr(resp, "data", None) or {}
    total = data.get("total_tokens", 0)
    return total < settings.daily_user_token_budget


async def record_usage(user_id: str, tokens: int) -> None:
    """Atomic increment via add_ai_tokens RPC. No-op for non-positive tokens."""
    if tokens <= 0:
        return
    db = get_supabase()
    db.rpc("add_ai_tokens", {"p_user_id": user_id, "p_tokens": tokens}).execute()
