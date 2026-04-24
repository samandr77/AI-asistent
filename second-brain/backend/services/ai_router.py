from __future__ import annotations
import asyncio
import logging
from enum import Enum
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
    medium = "medium"    # Claude Haiku 4.5:   $0.80/M in, $4/M out
    premium = "premium"  # Claude Sonnet 4.6:  $3/M in,   $15/M out

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


async def _call_groq(system: str, user: str, max_tokens: int) -> str:
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
    return resp.choices[0].message.content


async def _call_anthropic(model: str, system: str, user: str, max_tokens: int) -> str:
    if anthropic_client is None:
        raise RuntimeError("Anthropic client is not installed")
    resp = await anthropic_client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )
    return resp.content[0].text


_CALLERS = {
    AITier.cheap: lambda s, u, t: (
        _call_groq(s, u, t)
        if groq_client is not None
        else _call_anthropic("claude-haiku-4-5-20251001", s, u, t)
    ),
    AITier.medium: lambda s, u, t: _call_anthropic("claude-haiku-4-5-20251001", s, u, t),
    AITier.premium: lambda s, u, t: _call_anthropic("claude-sonnet-4-6", s, u, t),
}


async def complete(
    system: str,
    user: str,
    tier: AITier = AITier.cheap,
    max_tokens: int = 2000,
    retries: int = 2,
) -> str:
    current = tier
    while current is not None:
        for attempt in range(retries + 1):
            try:
                return await _CALLERS[current](system, user, max_tokens)
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                else:
                    logger.warning(
                        f"AI router: {current} failed after {retries + 1} attempts: {e}"
                    )
        current = _FALLBACK[current]
    raise RuntimeError("All AI providers failed")
