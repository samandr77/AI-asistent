import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_complete_returns_text_from_groq():
    with patch("services.ai_router.groq_client") as mock_groq:
        mock_choice = AsyncMock()
        mock_choice.message.content = "parsed result"
        mock_groq.chat.completions.create = AsyncMock(
            return_value=AsyncMock(choices=[mock_choice])
        )
        from services.ai_router import complete, AITier
        result = await complete("system prompt", "user input", tier=AITier.cheap)
    assert result == "parsed result"

@pytest.mark.anyio
async def test_complete_falls_back_to_anthropic_on_groq_failure():
    with patch("services.ai_router.groq_client") as mock_groq, \
         patch("services.ai_router.anthropic_client") as mock_anthropic:
        mock_groq.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        mock_content = AsyncMock()
        mock_content.text = "fallback result"
        mock_anthropic.messages.create = AsyncMock(
            return_value=AsyncMock(content=[mock_content])
        )
        from services.ai_router import complete, AITier
        result = await complete("system", "user", tier=AITier.cheap, retries=0)
    assert result == "fallback result"

@pytest.mark.anyio
async def test_complete_raises_when_all_tiers_fail():
    with patch("services.ai_router.groq_client") as mg, \
         patch("services.ai_router.anthropic_client") as ma:
        mg.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        ma.messages.create = AsyncMock(side_effect=Exception("anthropic down"))
        from services.ai_router import complete, AITier
        with pytest.raises(RuntimeError, match="All AI providers failed"):
            await complete("system", "user", tier=AITier.cheap, retries=0)
