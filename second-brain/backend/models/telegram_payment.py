from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


TelegramStarsCurrency = Literal["XTR"]
TelegramPaymentPlan = Literal["premium_monthly"]
TelegramPaymentStatus = Literal["pending", "paid", "refunded", "failed", "cancelled"]


class TelegramInvoiceRequest(BaseModel):
    plan_id: TelegramPaymentPlan = "premium_monthly"


class TelegramInvoiceResponse(BaseModel):
    invoice_link: str
    payload: str


class TelegramStarPayment(BaseModel):
    id: UUID
    user_id: UUID
    telegram_user_id: int
    plan_id: TelegramPaymentPlan
    invoice_payload: str
    telegram_payment_charge_id: str | None = None
    total_amount: int | None = Field(default=None, ge=0)
    currency: TelegramStarsCurrency | None = None
    subscription_expiration_date: datetime | None = None
    is_recurring: bool = False
    is_first_recurring: bool = False
    status: TelegramPaymentStatus = "pending"
    created_at: datetime
    updated_at: datetime


class TelegramPaymentRefreshResponse(BaseModel):
    premium_active: bool
    payment: TelegramStarPayment | None = None
