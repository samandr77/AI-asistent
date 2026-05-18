from __future__ import annotations

from datetime import datetime, timezone
from typing import Union

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from auth import issue_app_session_token
from database import get_supabase
from models.telegram import TelegramSessionRequest, TelegramSessionResponse
from services.account_cleanup import scheduled_purge_at
from services.telegram_init_data import (
    TelegramInitDataError,
    validate_telegram_init_data,
)
from services.telegram_users import bootstrap_telegram_user

router = APIRouter()


@router.post("/auth/session", response_model=TelegramSessionResponse)
async def create_telegram_session(body: TelegramSessionRequest):
    try:
        validated = validate_telegram_init_data(body.init_data)
    except TelegramInitDataError as exc:
        raise HTTPException(status_code=401, detail="Invalid Telegram launch data") from exc

    db = get_supabase()
    bootstrap = bootstrap_telegram_user(db, validated.telegram_user)

    if bootstrap.user.deleted_at:
        scheduled_for = scheduled_purge_at(
            _parse_ts(bootstrap.user.deleted_at)
        ).isoformat()
        return JSONResponse(
            status_code=410,
            content={
                "error": "account_pending_deletion",
                "scheduled_for": scheduled_for,
            },
        )

    token, expires_at = issue_app_session_token(
        str(bootstrap.user.id),
        telegram_user_id=validated.telegram_user.id,
    )
    return TelegramSessionResponse(
        access_token=token,
        expires_at=expires_at,
        user=bootstrap.user,
        profile=bootstrap.profile,
        is_new_user=bootstrap.is_new_user,
        start_param=body.start_param or validated.start_param,
    )


def _parse_ts(value: Union[str, datetime]) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    cleaned = value.replace("Z", "+00:00") if value.endswith("Z") else value
    return datetime.fromisoformat(cleaned)
