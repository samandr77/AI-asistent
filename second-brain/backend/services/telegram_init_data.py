from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from config import settings
from models.telegram import TelegramUser


class TelegramInitDataError(ValueError):
    pass


class TelegramInitDataExpired(TelegramInitDataError):
    pass


@dataclass(frozen=True)
class ValidatedTelegramInitData:
    raw: str
    telegram_user: TelegramUser
    auth_date: int
    start_param: str | None = None
    query_id: str | None = None


def validate_telegram_init_data(
    init_data: str,
    *,
    bot_token: str | None = None,
    max_age_seconds: int | None = None,
    now: int | None = None,
) -> ValidatedTelegramInitData:
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise TelegramInitDataError("Telegram initData hash is missing")

    if received_hash == "local-dev-only" and _local_dev_auth_enabled():
        return _validated_from_pairs(
            init_data,
            pairs,
            max_age_seconds=max_age_seconds,
            now=now,
        )

    token = bot_token if bot_token is not None else settings.telegram_bot_token
    if not token:
        raise TelegramInitDataError("Telegram bot token is not configured")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(pairs.items())
    )
    secret_key = hmac.new(
        b"WebAppData",
        token.encode(),
        hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise TelegramInitDataError("Telegram initData hash is invalid")

    return _validated_from_pairs(
        init_data,
        pairs,
        max_age_seconds=max_age_seconds,
        now=now,
    )


def _local_dev_auth_enabled() -> bool:
    return (
        settings.environment == "development"
        and settings.telegram_dev_auth_enabled
    )


def _validated_from_pairs(
    init_data: str,
    pairs: dict[str, str],
    *,
    max_age_seconds: int | None = None,
    now: int | None = None,
) -> ValidatedTelegramInitData:
    auth_date_raw = pairs.get("auth_date")
    if not auth_date_raw or not auth_date_raw.isdigit():
        raise TelegramInitDataError("Telegram initData auth_date is missing")

    auth_date = int(auth_date_raw)
    current_time = int(time.time()) if now is None else now
    max_age = (
        settings.telegram_init_data_max_age_seconds
        if max_age_seconds is None
        else max_age_seconds
    )
    if current_time - auth_date > max_age:
        raise TelegramInitDataExpired("Telegram initData is stale")

    user_raw = pairs.get("user")
    if not user_raw:
        raise TelegramInitDataError("Telegram initData user is missing")

    try:
        user = TelegramUser.model_validate(json.loads(user_raw))
    except (json.JSONDecodeError, ValueError) as exc:
        raise TelegramInitDataError("Telegram initData user is invalid") from exc

    return ValidatedTelegramInitData(
        raw=init_data,
        telegram_user=user,
        auth_date=auth_date,
        start_param=pairs.get("start_param") or None,
        query_id=pairs.get("query_id") or None,
    )
