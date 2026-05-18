from __future__ import annotations

import hmac

import sentry_sdk
from fastapi import APIRouter, Header, HTTPException

from api.dump import (
    _enforce_ai_budget,
    _enforce_dump_limit,
    _fetch_active_goals,
    save_tasks,
)
from config import settings
from models.telegram import TelegramMessage, TelegramUpdate
from services.goal_ranker import rank_today_top3
from services.parser import parse_dump
from services.premium import get_ai_tier_policy
from services.stt import transcribe_audio_with_fallback
from services.telegram_bot import TelegramBotClient, miniapp_keyboard
from services.telegram_payments import (
    TelegramPaymentInvalidPayload,
    answer_pre_checkout,
    process_refunded_payment,
    process_successful_payment,
)
from services.telegram_users import bootstrap_telegram_user
from database import get_supabase

router = APIRouter()


@router.post("/webhook")
async def telegram_webhook(
    update: TelegramUpdate,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    _validate_webhook_secret(x_telegram_bot_api_secret_token)

    if update.message:
        sentry_sdk.set_tag("telegram_update_type", "message")
        await _handle_message(update.message)
    elif update.pre_checkout_query:
        sentry_sdk.set_tag("telegram_update_type", "pre_checkout_query")
        await answer_pre_checkout(
            get_supabase(),
            TelegramBotClient(),
            update.pre_checkout_query,
        )

    return {"ok": True}


def _validate_webhook_secret(received: str | None) -> None:
    expected = settings.telegram_webhook_secret
    if not expected:
        raise HTTPException(status_code=503, detail="Telegram webhook secret is not configured")
    if not received or not hmac.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret")


async def _handle_message(message: TelegramMessage) -> None:
    if not message.from_:
        return

    sentry_sdk.set_tag("telegram_user_id", str(message.from_.id))
    sentry_sdk.set_tag("telegram_chat_id", str(message.chat.id))
    bot = TelegramBotClient()

    if message.successful_payment:
        await _handle_successful_payment(bot, message)
        return

    if message.refunded_payment:
        await _handle_refunded_payment(bot, message)
        return

    if message.text and message.text.startswith("/"):
        sentry_sdk.set_tag("telegram_update_type", "command")
        await _handle_command(bot, message)
        return

    if message.text and message.text.strip():
        sentry_sdk.set_tag("telegram_update_type", "text_dump")
        await _handle_text_dump(bot, message, message.text.strip())
        return

    if message.voice:
        sentry_sdk.set_tag("telegram_update_type", "voice_dump")
        await _handle_voice_dump(bot, message)
        return

    sentry_sdk.set_tag("telegram_update_type", "unsupported_message")
    await bot.send_message(
        message.chat.id,
        "Send text or a voice note and I will turn it into tasks.",
        reply_markup=miniapp_keyboard(),
    )


async def _handle_command(bot: TelegramBotClient, message: TelegramMessage) -> None:
    command = (message.text or "").split(maxsplit=1)[0].split("@", 1)[0]
    if command == "/start":
        await bot.send_message(
            message.chat.id,
            "Second Brain is ready.",
            reply_markup=miniapp_keyboard(),
        )
    elif command == "/help":
        await bot.send_message(
            message.chat.id,
            "Send a thought dump as text or voice. I will structure it into tasks.",
            reply_markup=miniapp_keyboard(),
        )
    elif command == "/paysupport":
        await bot.send_message(
            message.chat.id,
            "Telegram Stars payment support: open Second Brain Support or email support@second-brain.app.",
            reply_markup=miniapp_keyboard("Open support"),
        )
    elif command in {"/settings", "/premium", "/deleteaccount"}:
        await bot.send_message(
            message.chat.id,
            "Open Second Brain to continue.",
            reply_markup=miniapp_keyboard(),
        )
    else:
        await bot.send_message(message.chat.id, "Unknown command.")


async def _handle_text_dump(
    bot: TelegramBotClient,
    message: TelegramMessage,
    text: str,
) -> None:
    bootstrap = bootstrap_telegram_user(get_supabase(), message.from_)
    user_id = str(bootstrap.user.id)
    premium = await _enforce_dump_limit(user_id)
    await _enforce_ai_budget(user_id)
    active_goals = _fetch_active_goals(user_id)
    result = await parse_dump(
        text,
        {},
        active_goals=active_goals,
        tier_policy=get_ai_tier_policy(premium),
    )
    dump_id, task_ids = await save_tasks(result.parsed, user_id, text)
    top3 = rank_today_top3(result.parsed.tasks, active_goals)
    await bot.send_message(
        message.chat.id,
        _format_dump_summary(len(task_ids), len(top3)),
        reply_markup=miniapp_keyboard("Open result"),
    )
    sentry_sdk.set_tag("telegram_dump_id", dump_id)


async def _handle_successful_payment(
    bot: TelegramBotClient,
    message: TelegramMessage,
) -> None:
    if not message.from_ or not message.successful_payment:
        return
    sentry_sdk.set_tag("telegram_update_type", "successful_payment")
    try:
        process_successful_payment(
            get_supabase(),
            telegram_user=message.from_,
            payment=message.successful_payment,
            raw_update=message.model_dump(by_alias=True),
        )
    except TelegramPaymentInvalidPayload as exc:
        sentry_sdk.capture_exception(exc)
        await bot.send_message(
            message.chat.id,
            "Payment was received, but I could not activate Premium. Please contact support.",
            reply_markup=miniapp_keyboard("Open support"),
        )
        return

    await bot.send_message(
        message.chat.id,
        "Premium is active. Thank you for supporting Second Brain.",
        reply_markup=miniapp_keyboard("Open Premium"),
    )


async def _handle_refunded_payment(
    bot: TelegramBotClient,
    message: TelegramMessage,
) -> None:
    if not message.from_ or not message.refunded_payment:
        return
    sentry_sdk.set_tag("telegram_update_type", "refunded_payment")
    try:
        process_refunded_payment(
            get_supabase(),
            telegram_user=message.from_,
            payment=message.refunded_payment,
            raw_update=message.model_dump(by_alias=True),
        )
    except TelegramPaymentInvalidPayload as exc:
        sentry_sdk.capture_exception(exc)
        return

    await bot.send_message(
        message.chat.id,
        "Telegram Stars refund received. Premium status was refreshed.",
        reply_markup=miniapp_keyboard("Open Premium"),
    )


async def _handle_voice_dump(bot: TelegramBotClient, message: TelegramMessage) -> None:
    if not message.voice:
        return
    bootstrap = bootstrap_telegram_user(get_supabase(), message.from_)
    user_id = str(bootstrap.user.id)
    premium = await _enforce_dump_limit(user_id)
    await _enforce_ai_budget(user_id)
    file_info = await bot.get_file(message.voice.file_id)
    file_path = file_info.get("file_path")
    if not file_path:
        raise HTTPException(status_code=502, detail="Telegram file_path missing")
    audio_bytes = await bot.download_file(file_path)
    transcription = await transcribe_audio_with_fallback(audio_bytes, file_path)
    active_goals = _fetch_active_goals(user_id)
    result = await parse_dump(
        transcription,
        {},
        active_goals=active_goals,
        tier_policy=get_ai_tier_policy(premium),
    )
    dump_id, task_ids = await save_tasks(result.parsed, user_id, transcription)
    top3 = rank_today_top3(result.parsed.tasks, active_goals)
    await bot.send_message(
        message.chat.id,
        _format_dump_summary(len(task_ids), len(top3)),
        reply_markup=miniapp_keyboard("Open result"),
    )
    sentry_sdk.set_tag("telegram_dump_id", dump_id)


def _format_dump_summary(task_count: int, today_count: int) -> str:
    if task_count == 0:
        return "I saved the dump, but did not find tasks."
    return f"Created tasks: {task_count}. For today: {today_count}."
