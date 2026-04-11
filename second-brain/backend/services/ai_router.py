import asyncio
import logging
from enum import Enum
from groq import AsyncGroq
from anthropic import AsyncAnthropic
from config import settings

logger = logging.getLogger(__name__)

class AITier(str, Enum):
    cheap = "cheap"      # Groq Llama 3.3 70B: $0.59/M in, $0.79/M out
    medium = "medium"    # Claude Haiku 4.5:   $0.80/M in, $4/M out
    premium = "premium"  # Claude Sonnet 4.6:  $3/M in,   $15/M out

groq_client = AsyncGroq(api_key=settings.groq_api_key)
anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

_FALLBACK: dict[AITier, AITier | None] = {
    AITier.cheap: AITier.medium,
    AITier.medium: AITier.premium,
    AITier.premium: None,
}


async def _call_groq(system: str, user: str, max_tokens: int) -> str:
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
    resp = await anthropic_client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )
    return resp.content[0].text


_CALLERS = {
    AITier.cheap: lambda s, u, t: _call_groq(s, u, t),
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
