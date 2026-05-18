from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None
    is_premium: bool | None = None
    allows_write_to_pm: bool | None = None


class TelegramSessionRequest(BaseModel):
    init_data: str = Field(min_length=1)
    start_param: str | None = None


class TelegramSessionUser(BaseModel):
    id: UUID
    telegram_user_id: int
    provider: Literal["telegram"] = "telegram"
    name: str | None = None
    username: str | None = None
    language: str | None = None
    is_onboarded: bool = False
    deleted_at: datetime | None = None


class TelegramSessionResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: TelegramSessionUser
    profile: dict | None = None
    is_new_user: bool
    start_param: str | None = None


class TelegramReminderSettings(BaseModel):
    daily_reflection_enabled: bool = True
    daily_reflection_time: str = "21:00"
    morning_enabled: bool = False
    morning_time: str = "09:00"
    timezone: str | None = None

    @field_validator("daily_reflection_time", "morning_time")
    @classmethod
    def validate_hh_mm(cls, value: str) -> str:
        hours, separator, minutes = value.partition(":")
        if (
            separator != ":"
            or not hours.isdigit()
            or not minutes.isdigit()
            or not 0 <= int(hours) <= 23
            or not 0 <= int(minutes) <= 59
        ):
            raise ValueError("time must be HH:MM in 24-hour format")
        return f"{int(hours):02d}:{int(minutes):02d}"


class TelegramReminderSettingsResponse(TelegramReminderSettings):
    user_id: UUID
    telegram_user_id: int
    updated_at: datetime | None = None


class TelegramReminderSendError(BaseModel):
    user_id: UUID
    telegram_user_id: int | None = None
    error: str


class TelegramReminderSendReport(BaseModel):
    processed: int
    sent: int
    skipped: int
    errors: list[TelegramReminderSendError]
    ran_at: datetime


class TelegramChat(BaseModel):
    id: int
    type: str | None = None


class TelegramVoice(BaseModel):
    file_id: str
    file_unique_id: str | None = None
    duration: int | None = None
    mime_type: str | None = None
    file_size: int | None = None


class TelegramSuccessfulPayment(BaseModel):
    currency: str
    total_amount: int
    invoice_payload: str
    telegram_payment_charge_id: str
    provider_payment_charge_id: str | None = None
    subscription_expiration_date: int | None = None
    is_recurring: bool = False
    is_first_recurring: bool = False


class TelegramRefundedPayment(BaseModel):
    currency: str
    total_amount: int
    invoice_payload: str
    telegram_payment_charge_id: str
    provider_payment_charge_id: str | None = None


class TelegramMessage(BaseModel):
    message_id: int
    from_: TelegramUser | None = Field(default=None, alias="from")
    chat: TelegramChat
    text: str | None = None
    voice: TelegramVoice | None = None
    successful_payment: TelegramSuccessfulPayment | None = None
    refunded_payment: TelegramRefundedPayment | None = None


class TelegramPreCheckoutQuery(BaseModel):
    id: str
    from_: TelegramUser = Field(alias="from")
    currency: str
    total_amount: int
    invoice_payload: str


class TelegramUpdate(BaseModel):
    update_id: int
    message: TelegramMessage | None = None
    pre_checkout_query: TelegramPreCheckoutQuery | None = None
