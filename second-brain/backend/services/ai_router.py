from __future__ import annotations
import asyncio
import logging
from dataclasses import dataclass
from enum import Enum

import sentry_sdk

from config import settings

try:
    from groq import AsyncGroq
except ModuleNotFoundError:  # pragma: no cover - optional local dependency
    AsyncGroq = None  # type: ignore[assignment]

try:
    from anthropic import AsyncAnthropic
except ModuleNotFoundError:  # pragma: no cover - optional local dependency
    AsyncAnthropic = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class AITier(str, Enum):
    cheap = "cheap"      # Groq if configured, otherwise Claude Haiku
    medium = "medium"    # Claude Haiku 4.5
    premium = "premium"  # Claude Sonnet 4.6


# Mapping between premium.py's policy identifiers and AITier.
# Allows premium service to express allowed tiers without importing this module.
_POLICY_TO_TIER: dict[str, AITier] = {
    "groq_llama": AITier.cheap,
    "claude_haiku": AITier.medium,
    "claude_sonnet": AITier.premium,
}


@dataclass
class AIResult:
    text: str
    tokens: int
    tier: AITier


groq_client = (
    AsyncGroq(api_key=settings.groq_api_key)
    if AsyncGroq and settings.groq_api_key
    else None
)
anthropic_client = None
if AsyncAnthropic and settings.anthropic_api_key:
    anthropic_kwargs = {"api_key": settings.anthropic_api_key}
    if settings.anthropic_base_url:
        anthropic_kwargs["base_url"] = settings.anthropic_base_url
    anthropic_client = AsyncAnthropic(**anthropic_kwargs)

_FALLBACK: dict[AITier, AITier | None] = {
    AITier.cheap: AITier.medium,
    AITier.medium: AITier.premium,
    AITier.premium: None,
}


async def _call_groq(system: str, user: str, max_tokens: int) -> tuple[str, int]:
    if groq_client is None:
        raise RuntimeError("Groq client is not configured")
    resp = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    usage = resp.usage.total_tokens if resp.usage else 0
    return resp.choices[0].message.content, usage


async def _call_anthropic(model: str, system: str, user: str, max_tokens: int) -> tuple[str, int]:
    if anthropic_client is None:
        raise RuntimeError("Anthropic client is not installed")
    resp = await anthropic_client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )
    usage = (resp.usage.input_tokens + resp.usage.output_tokens) if resp.usage else 0
    return resp.content[0].text, usage


_CALLERS = {
    AITier.cheap: lambda s, u, t: (
        _call_groq(s, u, t)
        if groq_client is not None
        else _call_anthropic("claude-haiku-4-5-20251001", s, u, t)
    ),
    AITier.medium: lambda s, u, t: _call_anthropic("claude-haiku-4-5-20251001", s, u, t),
    AITier.premium: lambda s, u, t: _call_anthropic("claude-sonnet-4-6", s, u, t),
}


def _resolve_allowed_tiers(tier_policy: list[str] | None) -> set[AITier] | None:
    """Turn premium-policy strings into a set of AITier, or None for unrestricted."""
    if not tier_policy:
        return None
    allowed: set[AITier] = set()
    for key in tier_policy:
        tier = _POLICY_TO_TIER.get(key)
        if tier is not None:
            allowed.add(tier)
    return allowed or None


async def complete(
    system: str,
    user: str,
    tier: AITier = AITier.cheap,
    max_tokens: int = 2000,
    retries: int = 2,
    tier_policy: list[str] | None = None,
) -> AIResult:
    """Call LLM with automatic fallback across tiers.

    tier_policy: optional allowlist (e.g. ["groq_llama"] for free tier) — when set,
    tiers outside the list are skipped, preventing escalation to paid models.
    """
    allowed = _resolve_allowed_tiers(tier_policy)
    current: AITier | None = tier
    # If the requested tier is blocked by policy, step up until we find an allowed one.
    while current is not None and allowed is not None and current not in allowed:
        current = _FALLBACK[current]

    while current is not None:
        for attempt in range(retries + 1):
            try:
                text, tokens = await _CALLERS[current](system, user, max_tokens)
                if current != tier:
                    sentry_sdk.capture_message(
                        f"AI router fell back from {tier.value} to {current.value}",
                        level="warning",
                    )
                return AIResult(text=text, tokens=tokens, tier=current)
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                else:
                    sentry_sdk.capture_exception(e)
                    logger.warning(
                        "AI router: %s failed after %s attempts: %s",
                        current, retries + 1, e,
                    )
        # advance to next fallback, respecting policy
        nxt = _FALLBACK[current]
        while nxt is not None and allowed is not None and nxt not in allowed:
            nxt = _FALLBACK[nxt]
        current = nxt
    raise RuntimeError("All AI providers failed")
