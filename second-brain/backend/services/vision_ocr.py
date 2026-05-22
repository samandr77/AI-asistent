from __future__ import annotations
import base64
import json
import re
from typing import Any

from openai import AsyncOpenAI
from config import settings

_openai_client = (
    AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
)

_PROMPT = (
    "Извлеки из фото весь полезный текст и контекст: "
    "если это чек — товары/суммы/итого/дата/магазин; "
    "если рукопись или заметка — текст как есть; "
    "если скриншот переписки — кто что сказал. "
    "Верни ОДНИМ простым русским текстом без markdown."
)


async def ocr_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    if not image_bytes:
        raise ValueError("Cannot OCR empty image")
    if _openai_client is None:
        raise RuntimeError("OpenAI Vision is not configured")

    if mime_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        mime_type = "image/jpeg"

    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{b64}"

    response = await _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        max_tokens=800,
    )
    text = response.choices[0].message.content or ""
    return text.strip()


_FOOD_PROMPT = """Ты анализируешь фото упаковки еды, этикетки или пищевой таблицы.
Верни только JSON-объект без markdown.
Поля:
name, brand, barcode, serving_name, serving_grams,
calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
fiber_per_100g, sugar_per_100g, sodium_mg_per_100g, saturated_fat_per_100g,
micronutrients, confidence, raw_text.
Если значения нет или оно не видно — null. Не выдумывай нутриенты.
confidence от 0 до 1. raw_text — краткий извлечённый текст с этикетки."""


def _json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return parsed if isinstance(parsed, dict) else {}


async def analyze_food_package_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Cannot analyze empty image")
    if _openai_client is None:
        raise RuntimeError("OpenAI Vision is not configured")

    if mime_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        mime_type = "image/jpeg"

    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{b64}"
    response = await _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _FOOD_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        max_tokens=900,
        temperature=0.1,
    )
    text = response.choices[0].message.content or ""
    return _json_object(text)
