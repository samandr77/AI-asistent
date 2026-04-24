from __future__ import annotations
import math
import logging
from datetime import datetime, timezone, timedelta
from config import settings
from database import get_supabase
from models.premium import PremiumStatus

logger = logging.getLogger(__name__)


async def get_user_premium(user_id: str) -> PremiumStatus:
    """Fetch premium status for a user. Fail-safe: returns free-tier defaults on any error."""
    try:
        db = get_supabase()
        result = (
            db.table("user_premium")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return PremiumStatus()
        row = result.data[0]
        return PremiumStatus(
            is_premium=bool(row.get("is_premium", False)),
            entitlement_id=row.get("entitlement_id"),
            expires_at=row.get("expires_at"),
            period_type=row.get("period_type"),
            store=row.get("store"),
            cancelled=row.get("cancelled_at") is not None,
        )
    except Exception:
        logger.exception("get_user_premium failed for user_id=%s — defaulting to free", user_id)
        return PremiumStatus()


def get_daily_token_budget(premium: PremiumStatus) -> int:
    if premium.is_premium:
        return settings.daily_premium_token_budget
    return settings.daily_free_token_budget


def get_daily_dump_limit(premium: PremiumStatus) -> int | float:
    """Returns math.inf for premium users (no limit)."""
    if premium.is_premium:
        return math.inf
    return settings.free_daily_dump_limit


def get_ai_tier_policy(premium: PremiumStatus) -> list[str]:
    """Returns ordered list of AI tiers available to the user (cheapest first)."""
    if premium.is_premium:
        return ["groq_llama", "claude_haiku", "claude_sonnet"]
    return ["groq_llama"]


def get_max_active_goals(premium: PremiumStatus) -> int | float:
    """Returns math.inf for premium users (no limit)."""
    if premium.is_premium:
        return math.inf
    return settings.free_max_active_goals


def get_history_cutoff(premium: PremiumStatus) -> datetime | None:
    """Returns cutoff datetime for history; None means full history (premium)."""
    if premium.is_premium:
        return None
    return datetime.now(timezone.utc) - timedelta(days=settings.free_history_days)
