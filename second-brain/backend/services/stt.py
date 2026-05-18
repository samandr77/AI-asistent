from __future__ import annotations
import io
import httpx
from openai import AsyncOpenAI
from config import settings

openai_client = (
    AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
)
_SUPPORTED_FORMATS = {"m4a", "mp3", "wav", "webm", "ogg"}
_HF_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.m4a",
    language: str | None = None,
) -> str:
    if not audio_bytes:
        raise ValueError("Cannot transcribe empty audio")
    if openai_client is None:
        raise RuntimeError("OpenAI STT is not configured")

    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in _SUPPORTED_FORMATS:
        ext = "m4a"

    buf = io.BytesIO(audio_bytes)
    buf.name = f"audio.{ext}"

    kwargs: dict = {
        "model": "gpt-4o-mini-transcribe",
        "file": buf,
        "response_format": "text",
        "prompt": "Задачи, дедлайны, встречи, покупки, напоминания.",
    }
    if language:
        kwargs["language"] = language

    return await openai_client.audio.transcriptions.create(**kwargs)


async def _transcribe_via_huggingface(audio_bytes: bytes) -> str:
    if not settings.huggingface_api_key:
        raise RuntimeError("HuggingFace STT fallback is not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _HF_URL,
            content=audio_bytes,
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type": "audio/m4a",
            },
        )
        resp.raise_for_status()
        return resp.json().get("text", "")


async def transcribe_audio_with_fallback(
    audio_bytes: bytes, filename: str = "audio.m4a"
) -> str:
    try:
        return await transcribe_audio(audio_bytes, filename)
    except Exception:
        return await _transcribe_via_huggingface(audio_bytes)
