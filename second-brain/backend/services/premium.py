from __future__ import annotations
import math
import logging
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
    # Test build: keep functionality open while premium is disabled.
    return settings.daily_premium_token_budget


def get_daily_dump_limit(premium: PremiumStatus) -> int | float:
    """Test build: no dump limit while premium is disabled."""
    return math.inf


def get_ai_tier_policy(premium: PremiumStatus) -> list[str]:
    """Test build: all AI tiers are available, cheapest first."""
    return ["groq_llama", "claude_haiku", "claude_sonnet"]


def get_max_active_goals(premium: PremiumStatus) -> int | float:
    """Test build: no active-goal limit while premium is disabled."""
    return math.inf


def get_history_cutoff(premium: PremiumStatus):
    """Test build: full history for everyone while premium is disabled."""
    return None
