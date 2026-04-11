import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.anyio
async def test_complete_returns_text_from_groq():
    from services.ai_router import complete, AITier

    mock_choice = MagicMock()
    mock_choice.message.content = "parsed result"

    with patch("services.ai_router.groq_client") as mock_groq:
        mock_groq.chat.completions.create = AsyncMock(
            return_value=MagicMock(choices=[mock_choice])
        )
        result = await complete("system prompt", "user input", tier=AITier.cheap)

    assert result == "parsed result"
    mock_groq.chat.completions.create.assert_called_once()

@pytest.mark.anyio
async def test_complete_falls_back_to_anthropic_on_groq_failure():
    from services.ai_router import complete, AITier

    mock_content = MagicMock()
    mock_content.text = "fallback result"

    with patch("services.ai_router.groq_client") as mock_groq, \
         patch("services.ai_router.anthropic_client") as mock_anthropic:
        mock_groq.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        mock_anthropic.messages.create = AsyncMock(
            return_value=MagicMock(content=[mock_content])
        )
        result = await complete("system", "user", tier=AITier.cheap, retries=0)

    assert result == "fallback result"
    mock_groq.chat.completions.create.assert_called_once()
    mock_anthropic.messages.create.assert_called_once()

@pytest.mark.anyio
async def test_complete_raises_when_all_tiers_fail():
    from services.ai_router import complete, AITier

    with patch("services.ai_router.groq_client") as mg, \
         patch("services.ai_router.anthropic_client") as ma:
        mg.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        ma.messages.create = AsyncMock(side_effect=Exception("anthropic down"))

        with pytest.raises(RuntimeError, match="All AI providers failed"):
            await complete("system", "user", tier=AITier.cheap, retries=0)
