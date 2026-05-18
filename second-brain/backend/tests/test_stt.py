import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_transcribe_returns_text():
    mock_response = "купить молоко завтра вечером"
    with patch("services.stt.openai_client") as mock_client:
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_response)
        from services.stt import transcribe_audio
        result = await transcribe_audio(b"fake-audio-bytes", "audio.m4a")
    assert result == mock_response

@pytest.mark.anyio
async def test_transcribe_empty_audio_raises():
    from services.stt import transcribe_audio
    with pytest.raises(ValueError, match="empty"):
        await transcribe_audio(b"", "audio.m4a")

@pytest.mark.anyio
async def test_transcribe_with_fallback_on_openai_error():
    with patch("services.stt.openai_client") as mock_openai, \
         patch("services.stt._transcribe_via_huggingface", new=AsyncMock(return_value="fallback text")):
        mock_openai.audio.transcriptions.create = AsyncMock(side_effect=Exception("rate limit"))
        from services.stt import transcribe_audio_with_fallback
        result = await transcribe_audio_with_fallback(b"audio", "audio.m4a")
    assert result == "fallback text"
