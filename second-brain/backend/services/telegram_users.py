from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from models.telegram import TelegramSessionUser, TelegramUser


@dataclass(frozen=True)
class TelegramBootstrapResult:
    user: TelegramSessionUser
    profile: dict[str, Any] | None
    is_new_user: bool


def bootstrap_telegram_user(db: Any, telegram_user: TelegramUser) -> TelegramBootstrapResult:
    account_result = (
        db.table("telegram_accounts")
        .select("*")
        .eq("telegram_user_id", telegram_user.id)
        .execute()
    )
    account_row = account_result.data[0] if account_result.data else None

    if account_row:
        user_id = account_row["user_id"]
        _update_telegram_account(db, telegram_user)
        is_new_user = False
    else:
        user_id = _create_auth_user(db, telegram_user)
        _create_telegram_account(db, user_id, telegram_user)
        is_new_user = True

    profile = _load_profile(db, user_id)
    if profile is None:
        profile = _upsert_initial_profile(db, user_id, telegram_user)

    return TelegramBootstrapResult(
        user=TelegramSessionUser(
            id=user_id,
            telegram_user_id=telegram_user.id,
            name=profile.get("name") if profile else telegram_user.first_name,
            username=telegram_user.username,
            language=profile.get("language") if profile else telegram_user.language_code,
            is_onboarded=bool(profile.get("is_onboarded")) if profile else False,
            deleted_at=profile.get("deleted_at") if profile else None,
        ),
        profile=profile,
        is_new_user=is_new_user,
    )


def _create_auth_user(db: Any, telegram_user: TelegramUser) -> str:
    email = f"telegram-{telegram_user.id}@telegram.second-brain.local"
    password = secrets.token_urlsafe(32)
    response = db.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "provider": "telegram",
                "telegram_user_id": telegram_user.id,
                "username": telegram_user.username,
            },
        }
    )
    return _extract_created_user_id(response)


def _extract_created_user_id(response: Any) -> str:
    user = getattr(response, "user", None)
    if user is not None:
        user_id = getattr(user, "id", None)
        if user_id:
            return str(user_id)

    data = getattr(response, "data", None)
    if isinstance(data, dict):
        user_id = data.get("id") or data.get("user", {}).get("id")
        if user_id:
            return str(user_id)

    if isinstance(response, dict):
        user_id = response.get("id") or response.get("user", {}).get("id")
        if user_id:
            return str(user_id)

    raise RuntimeError("Supabase auth user creation returned no user id")


def _telegram_account_payload(user_id: str, telegram_user: TelegramUser) -> dict[str, Any]:
    return {
        "telegram_user_id": telegram_user.id,
        "user_id": user_id,
        "username": telegram_user.username,
        "first_name": telegram_user.first_name,
        "last_name": telegram_user.last_name,
        "language_code": telegram_user.language_code,
        "allows_write_to_pm": bool(telegram_user.allows_write_to_pm),
        "last_auth_at": datetime.now(timezone.utc).isoformat(),
    }


def _create_telegram_account(
    db: Any,
    user_id: str,
    telegram_user: TelegramUser,
) -> None:
    db.table("telegram_accounts").insert(
        _telegram_account_payload(user_id, telegram_user)
    ).execute()


def _update_telegram_account(db: Any, telegram_user: TelegramUser) -> None:
    payload = _telegram_account_payload("", telegram_user)
    payload.pop("telegram_user_id", None)
    payload.pop("user_id", None)
    db.table("telegram_accounts").update(payload).eq(
        "telegram_user_id", telegram_user.id
    ).execute()


def _load_profile(db: Any, user_id: str) -> dict[str, Any] | None:
    result = db.table("user_profiles").select("*").eq("id", user_id).execute()
    return result.data[0] if result.data else None


def _upsert_initial_profile(
    db: Any,
    user_id: str,
    telegram_user: TelegramUser,
) -> dict[str, Any] | None:
    payload = {
        "id": user_id,
        "name": telegram_user.first_name,
        "language": telegram_user.language_code or "ru",
    }
    result = db.table("user_profiles").upsert(payload).execute()
    return result.data[0] if result.data else payload
