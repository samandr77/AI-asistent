from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user_id
from database import get_supabase
from models.premium import PremiumStatus
from models.telegram_payment import TelegramInvoiceRequest, TelegramInvoiceResponse
from services.telegram_payments import (
    TelegramPaymentAccountNotFound,
    create_telegram_invoice,
    refresh_telegram_premium,
)

router = APIRouter()


@router.post("/payments/invoice", response_model=TelegramInvoiceResponse)
async def create_payment_invoice(
    body: TelegramInvoiceRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return await create_telegram_invoice(
            get_supabase(),
            user_id=user_id,
            plan_id=body.plan_id,
        )
    except TelegramPaymentAccountNotFound:
        raise HTTPException(status_code=404, detail="Telegram account not found")


@router.post("/payments/refresh", response_model=PremiumStatus)
async def refresh_payment_status(user_id: str = Depends(get_current_user_id)):
    return await refresh_telegram_premium(user_id)
