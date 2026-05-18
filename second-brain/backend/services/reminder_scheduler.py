from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from models.telegram import TelegramReminderSendError, TelegramReminderSendReport
from services.telegram_bot import TelegramBotClient, miniapp_keyboard


def select_due_reflection_reminders(db: Any, now: datetime | None = None) -> list[dict]:
    current = now or datetime.now(timezone.utc)
    current_date = current.date().isoformat()
    current_time = current.strftime("%H:%M")
    result = (
        db.table("telegram_reminder_settings")
        .select("*")
        .eq("daily_reflection_enabled", True)
        .eq("daily_reflection_time", current_time)
        .execute()
    )
    rows = result.data or []
    return [
        row
        for row in rows
        if row.get("last_daily_reflection_sent_for") != current_date
    ]


async def send_due_reflection_reminders(
    db: Any,
    *,
    bot: TelegramBotClient | None = None,
    now: datetime | None = None,
) -> TelegramReminderSendReport:
    current = now or datetime.now(timezone.utc)
    current_date = current.date().isoformat()
    client = bot or TelegramBotClient()
    rows = select_due_reflection_reminders(db, current)
    sent = 0
    skipped = 0
    errors: list[TelegramReminderSendError] = []

    for row in rows:
        try:
            await client.send_message(
                int(row["telegram_user_id"]),
                "Time for your evening reflection.",
                reply_markup=miniapp_keyboard("Open reflection"),
            )
            (
                db.table("telegram_reminder_settings")
                .update({"last_daily_reflection_sent_for": current_date})
                .eq("user_id", row["user_id"])
                .execute()
            )
            sent += 1
        except Exception as exc:
            errors.append(
                TelegramReminderSendError(
                    user_id=row["user_id"],
                    telegram_user_id=row.get("telegram_user_id"),
                    error=str(exc),
                )
            )
            skipped += 1

    return TelegramReminderSendReport(
        processed=len(rows),
        sent=sent,
        skipped=skipped,
        errors=errors,
        ran_at=current,
    )
