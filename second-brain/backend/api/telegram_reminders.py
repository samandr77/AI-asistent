from __future__ import annotations

import hmac
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from auth import get_current_user_id
from config import settings
from database import get_supabase
from models.telegram import TelegramReminderSendReport, TelegramReminderSettings
from services.reminder_scheduler import send_due_reflection_reminders
from services.telegram_bot import TelegramBotClient, miniapp_keyboard

router = APIRouter()


def _require_admin_bearer(authorization: Optional[str]) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="admin bearer required",
        )
    provided = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(provided, settings.admin_cleanup_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid admin bearer",
        )


@router.get("/reminders/settings", response_model=TelegramReminderSettings)
async def get_reminder_settings(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("telegram_reminder_settings")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return TelegramReminderSettings()
    return TelegramReminderSettings.model_validate(result.data[0])


@router.put("/reminders/settings", response_model=TelegramReminderSettings)
async def put_reminder_settings(
    body: TelegramReminderSettings,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    account_result = (
        db.table("telegram_accounts")
        .select("telegram_user_id")
        .eq("user_id", user_id)
        .execute()
    )
    if not account_result.data:
        raise HTTPException(status_code=404, detail="Telegram account not found")

    payload = body.model_dump()
    payload["user_id"] = user_id
    payload["telegram_user_id"] = account_result.data[0]["telegram_user_id"]
    result = db.table("telegram_reminder_settings").upsert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save reminder settings")
    return TelegramReminderSettings.model_validate(result.data[0])


@router.post("/reminders/test")
async def send_test_reminder(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    account_result = (
        db.table("telegram_accounts")
        .select("telegram_user_id")
        .eq("user_id", user_id)
        .execute()
    )
    if not account_result.data:
        raise HTTPException(status_code=404, detail="Telegram account not found")
    bot = TelegramBotClient()
    await bot.send_message(
        int(account_result.data[0]["telegram_user_id"]),
        "This is a Second Brain reminder test.",
        reply_markup=miniapp_keyboard("Open settings"),
    )
    return {"ok": True}


@router.post("/reminders/send-due", response_model=TelegramReminderSendReport)
async def send_due_reminders(authorization: Optional[str] = Header(default=None)):
    _require_admin_bearer(authorization)
    return await send_due_reflection_reminders(get_supabase())
