from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from config import settings
from models.premium import PremiumStatus
from models.telegram import (
    TelegramPreCheckoutQuery,
    TelegramRefundedPayment,
    TelegramSuccessfulPayment,
    TelegramUser,
)
from models.telegram_payment import (
    TelegramInvoiceResponse,
    TelegramPaymentPlan,
    TelegramStarPayment,
)
from services.premium import get_user_premium
from services.telegram_bot import TelegramBotClient

PREMIUM_MONTHLY_PLAN: TelegramPaymentPlan = "premium_monthly"
PREMIUM_MONTHLY_SECONDS = 30 * 24 * 60 * 60
TELEGRAM_STARS_CURRENCY = "XTR"


class TelegramPaymentError(RuntimeError):
    pass


class TelegramPaymentAccountNotFound(TelegramPaymentError):
    pass


class TelegramPaymentInvalidPayload(TelegramPaymentError):
    pass


def create_invoice_payload(user_id: str, plan_id: TelegramPaymentPlan) -> str:
    nonce = secrets.token_urlsafe(16)
    base = f"{plan_id}:{user_id}:{nonce}"
    signature = _payload_signature(base)
    return f"{base}:{signature}"


def validate_invoice_payload(payload: str) -> tuple[TelegramPaymentPlan, str]:
    parts = payload.split(":")
    if len(parts) != 4:
        raise TelegramPaymentInvalidPayload("Invalid invoice payload format")
    plan_id, user_id, nonce, signature = parts
    if plan_id != PREMIUM_MONTHLY_PLAN or not user_id or not nonce:
        raise TelegramPaymentInvalidPayload("Invalid invoice payload content")
    base = f"{plan_id}:{user_id}:{nonce}"
    if not hmac.compare_digest(signature, _payload_signature(base)):
        raise TelegramPaymentInvalidPayload("Invalid invoice payload signature")
    return plan_id, user_id


async def create_telegram_invoice(
    db: Any,
    *,
    user_id: str,
    plan_id: TelegramPaymentPlan,
    bot: TelegramBotClient | None = None,
) -> TelegramInvoiceResponse:
    account_result = (
        db.table("telegram_accounts")
        .select("telegram_user_id")
        .eq("user_id", user_id)
        .execute()
    )
    if not account_result.data:
        raise TelegramPaymentAccountNotFound("Telegram account not found")

    telegram_user_id = int(account_result.data[0]["telegram_user_id"])
    amount = settings.telegram_premium_monthly_stars
    payload = create_invoice_payload(user_id, plan_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    row = {
        "user_id": user_id,
        "telegram_user_id": telegram_user_id,
        "plan_id": plan_id,
        "invoice_payload": payload,
        "total_amount": amount,
        "currency": TELEGRAM_STARS_CURRENCY,
        "status": "pending",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    db.table("telegram_star_payments").insert(row).execute()

    client = bot or TelegramBotClient()
    try:
        invoice_link = await client.create_invoice_link(
            title="Second Brain Premium",
            description="Monthly premium access for Second Brain.",
            payload=payload,
            currency=TELEGRAM_STARS_CURRENCY,
            prices=[{"label": "Premium monthly", "amount": amount}],
            subscription_period=PREMIUM_MONTHLY_SECONDS,
        )
    except Exception:
        (
            db.table("telegram_star_payments")
            .update({"status": "failed", "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("invoice_payload", payload)
            .execute()
        )
        raise

    return TelegramInvoiceResponse(invoice_link=invoice_link, payload=payload)


async def answer_pre_checkout(
    db: Any,
    bot: TelegramBotClient,
    query: TelegramPreCheckoutQuery,
) -> bool:
    ok, error = validate_pre_checkout(db, query)
    await bot.answer_pre_checkout_query(
        query.id,
        ok=ok,
        error_message=None if ok else error,
    )
    return ok


def validate_pre_checkout(
    db: Any,
    query: TelegramPreCheckoutQuery,
) -> tuple[bool, str | None]:
    try:
        plan_id, user_id = validate_invoice_payload(query.invoice_payload)
    except TelegramPaymentInvalidPayload as exc:
        return False, str(exc)

    if query.currency != TELEGRAM_STARS_CURRENCY:
        return False, "Unsupported currency"
    if query.total_amount != settings.telegram_premium_monthly_stars:
        return False, "Unexpected payment amount"

    result = (
        db.table("telegram_star_payments")
        .select("*")
        .eq("invoice_payload", query.invoice_payload)
        .execute()
    )
    if not result.data:
        return False, "Invoice not found"
    row = result.data[0]
    if row.get("status") != "pending":
        return False, "Invoice is not pending"
    if row.get("plan_id") != plan_id or str(row.get("user_id")) != user_id:
        return False, "Invoice mismatch"
    if int(row.get("telegram_user_id")) != query.from_.id:
        return False, "Telegram account mismatch"
    return True, None


def process_successful_payment(
    db: Any,
    *,
    telegram_user: TelegramUser,
    payment: TelegramSuccessfulPayment,
    raw_update: dict | None = None,
) -> TelegramStarPayment:
    plan_id, user_id = validate_invoice_payload(payment.invoice_payload)
    result = (
        db.table("telegram_star_payments")
        .select("*")
        .eq("invoice_payload", payment.invoice_payload)
        .execute()
    )
    if not result.data:
        raise TelegramPaymentInvalidPayload("Invoice not found")
    row = result.data[0]
    if row.get("plan_id") != plan_id or str(row.get("user_id")) != user_id:
        raise TelegramPaymentInvalidPayload("Invoice mismatch")
    if int(row.get("telegram_user_id")) != telegram_user.id:
        raise TelegramPaymentInvalidPayload("Telegram account mismatch")
    if payment.currency != TELEGRAM_STARS_CURRENCY:
        raise TelegramPaymentInvalidPayload("Unsupported currency")

    expiration = _payment_expiration(payment)
    now_iso = datetime.now(timezone.utc).isoformat()
    update_row = {
        "telegram_payment_charge_id": payment.telegram_payment_charge_id,
        "total_amount": payment.total_amount,
        "currency": payment.currency,
        "subscription_expiration_date": expiration.isoformat(),
        "is_recurring": payment.is_recurring,
        "is_first_recurring": payment.is_first_recurring,
        "status": "paid",
        "raw_update": raw_update,
        "updated_at": now_iso,
    }
    update_result = (
        db.table("telegram_star_payments")
        .update(update_row)
        .eq("invoice_payload", payment.invoice_payload)
        .execute()
    )
    paid_row = (update_result.data or [{**row, **update_row}])[0]

    db.table("user_premium").upsert(
        {
            "user_id": user_id,
            "is_premium": True,
            "entitlement_id": "premium",
            "product_id": "telegram_premium_monthly",
            "period_type": "normal",
            "purchase_date": now_iso,
            "expires_at": expiration.isoformat(),
            "store": "telegram_stars",
            "cancelled_at": None,
        },
        on_conflict="user_id",
    ).execute()

    return TelegramStarPayment.model_validate(paid_row)


def process_refunded_payment(
    db: Any,
    *,
    telegram_user: TelegramUser,
    payment: TelegramRefundedPayment,
    raw_update: dict | None = None,
) -> TelegramStarPayment:
    plan_id, user_id = validate_invoice_payload(payment.invoice_payload)
    result = (
        db.table("telegram_star_payments")
        .select("*")
        .eq("invoice_payload", payment.invoice_payload)
        .execute()
    )
    if not result.data:
        raise TelegramPaymentInvalidPayload("Invoice not found")
    row = result.data[0]
    if row.get("plan_id") != plan_id or str(row.get("user_id")) != user_id:
        raise TelegramPaymentInvalidPayload("Invoice mismatch")
    if int(row.get("telegram_user_id")) != telegram_user.id:
        raise TelegramPaymentInvalidPayload("Telegram account mismatch")
    if payment.currency != TELEGRAM_STARS_CURRENCY:
        raise TelegramPaymentInvalidPayload("Unsupported currency")

    update_row = {
        "telegram_payment_charge_id": payment.telegram_payment_charge_id,
        "total_amount": payment.total_amount,
        "currency": payment.currency,
        "status": "refunded",
        "raw_update": raw_update,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    update_result = (
        db.table("telegram_star_payments")
        .update(update_row)
        .eq("invoice_payload", payment.invoice_payload)
        .execute()
    )
    refunded_row = (update_result.data or [{**row, **update_row}])[0]

    premium_result = (
        db.table("user_premium")
        .select("user_id,store")
        .eq("user_id", user_id)
        .execute()
    )
    if premium_result.data and premium_result.data[0].get("store") == "telegram_stars":
        (
            db.table("user_premium")
            .update(
                {
                    "is_premium": False,
                    "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    "store": "telegram_stars",
                }
            )
            .eq("user_id", user_id)
            .execute()
        )

    return TelegramStarPayment.model_validate(refunded_row)


async def refresh_telegram_premium(user_id: str) -> PremiumStatus:
    return await get_user_premium(user_id)


def _payload_signature(base: str) -> str:
    secret = settings.app_session_jwt_secret or settings.telegram_bot_token
    return hmac.new(secret.encode(), base.encode(), hashlib.sha256).hexdigest()[:16]


def _payment_expiration(payment: TelegramSuccessfulPayment) -> datetime:
    if payment.subscription_expiration_date:
        return datetime.fromtimestamp(
            payment.subscription_expiration_date,
            tz=timezone.utc,
        )
    return datetime.now(timezone.utc) + timedelta(seconds=PREMIUM_MONTHLY_SECONDS)
