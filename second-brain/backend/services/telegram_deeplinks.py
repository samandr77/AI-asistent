from __future__ import annotations

from urllib.parse import quote, urlencode

from config import settings


def normalize_bot_username(username: str | None = None) -> str:
    value = username if username is not None else settings.telegram_bot_username
    return value.strip().removeprefix("@")


def build_start_param(kind: str, value: str | None = None) -> str:
    if value:
        return f"{kind}:{value}"
    return kind


def build_miniapp_url(start_param: str | None = None) -> str:
    base_url = settings.telegram_miniapp_url.rstrip("/")
    if not start_param:
        return base_url
    return f"{base_url}?{urlencode({'tgWebAppStartParam': start_param})}"


def build_bot_startapp_url(start_param: str | None = None) -> str:
    username = normalize_bot_username()
    if not username:
        raise ValueError("TELEGRAM_BOT_USERNAME is required to build startapp URLs")

    url = f"https://t.me/{quote(username)}"
    if start_param:
        return f"{url}?startapp={quote(start_param)}"
    return url
