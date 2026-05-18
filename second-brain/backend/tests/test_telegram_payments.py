from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from models.premium import PremiumStatus
from models.telegram import (
    TelegramPreCheckoutQuery,
    TelegramRefundedPayment,
    TelegramSuccessfulPayment,
    TelegramUser,
)
from models.telegram_payment import TelegramInvoiceResponse
from services.telegram_payments import (
    PREMIUM_MONTHLY_SECONDS,
    PREMIUM_MONTHLY_PLAN,
    TELEGRAM_STARS_CURRENCY,
    answer_pre_checkout,
    create_invoice_payload,
    create_telegram_invoice,
    process_refunded_payment,
    process_successful_payment,
)


TEST_USER_ID = "00000000-0000-4000-8000-000000000301"
PAYMENT_ID = "00000000-0000-4000-8000-000000000401"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def authed_client():
    import auth
    from main import app

    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_ID
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_telegram_invoice_creates_pending_invoice_and_bot_link():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"telegram_user_id": 1001}
    ]
    db.table.return_value.insert.return_value.execute.return_value.data = []
    bot = MagicMock()
    bot.create_invoice_link = AsyncMock(return_value="https://t.me/$invoice/test")

    with patch("services.telegram_payments.secrets.token_urlsafe", return_value="nonce"):
        response = await create_telegram_invoice(
            db,
            user_id=TEST_USER_ID,
            plan_id=PREMIUM_MONTHLY_PLAN,
            bot=bot,
        )

    assert response.invoice_link == "https://t.me/$invoice/test"
    assert response.payload.startswith(f"{PREMIUM_MONTHLY_PLAN}:{TEST_USER_ID}:nonce:")
    insert_payload = db.table.return_value.insert.call_args.args[0]
    assert insert_payload["telegram_user_id"] == 1001
    assert insert_payload["currency"] == TELEGRAM_STARS_CURRENCY
    bot.create_invoice_link.assert_awaited_once()
    kwargs = bot.create_invoice_link.await_args.kwargs
    assert kwargs["currency"] == TELEGRAM_STARS_CURRENCY
    assert kwargs["subscription_period"] == PREMIUM_MONTHLY_SECONDS
    assert kwargs["prices"][0]["amount"] == 499
    assert "provider_token" not in kwargs


@pytest.mark.anyio
async def test_invoice_endpoint_returns_invoice_response(authed_client):
    with (
        patch("api.telegram_payments.get_supabase", return_value=MagicMock()),
        patch(
            "api.telegram_payments.create_telegram_invoice",
            new=AsyncMock(
                return_value=TelegramInvoiceResponse(
                    invoice_link="https://t.me/$invoice/test",
                    payload="premium_monthly:test:nonce:sig",
                )
            ),
        ) as mock_create,
    ):
        resp = await authed_client.post(
            "/telegram/payments/invoice",
            json={"plan_id": "premium_monthly"},
        )

    assert resp.status_code == 200
    assert resp.json()["invoice_link"] == "https://t.me/$invoice/test"
    mock_create.assert_awaited_once()


@pytest.mark.anyio
async def test_pre_checkout_accepts_valid_pending_invoice():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "user_id": TEST_USER_ID,
            "telegram_user_id": 1001,
            "plan_id": PREMIUM_MONTHLY_PLAN,
            "invoice_payload": payload,
            "status": "pending",
        }
    ]
    bot = MagicMock()
    bot.answer_pre_checkout_query = AsyncMock()
    query = TelegramPreCheckoutQuery.model_validate(
        {
            "id": "pre-checkout-1",
            "from": {"id": 1001, "first_name": "Alex"},
            "currency": "XTR",
            "total_amount": 499,
            "invoice_payload": payload,
        }
    )

    ok = await answer_pre_checkout(db, bot, query)

    assert ok is True
    bot.answer_pre_checkout_query.assert_awaited_once_with(
        "pre-checkout-1",
        ok=True,
        error_message=None,
    )


@pytest.mark.anyio
async def test_pre_checkout_rejects_wrong_amount():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "user_id": TEST_USER_ID,
            "telegram_user_id": 1001,
            "plan_id": PREMIUM_MONTHLY_PLAN,
            "invoice_payload": payload,
            "status": "pending",
        }
    ]
    bot = MagicMock()
    bot.answer_pre_checkout_query = AsyncMock()
    query = TelegramPreCheckoutQuery.model_validate(
        {
            "id": "pre-checkout-1",
            "from": {"id": 1001, "first_name": "Alex"},
            "currency": "XTR",
            "total_amount": 1,
            "invoice_payload": payload,
        }
    )

    ok = await answer_pre_checkout(db, bot, query)

    assert ok is False
    bot.answer_pre_checkout_query.assert_awaited_once()
    assert bot.answer_pre_checkout_query.await_args.kwargs["ok"] is False


def test_successful_payment_activates_user_premium():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    expires_at = int(datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc).timestamp())
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": PAYMENT_ID,
            "user_id": TEST_USER_ID,
            "telegram_user_id": 1001,
            "plan_id": PREMIUM_MONTHLY_PLAN,
            "invoice_payload": payload,
            "status": "pending",
            "created_at": "2026-05-02T00:00:00+00:00",
            "updated_at": "2026-05-02T00:00:00+00:00",
        }
    ]
    paid_row = {
        "id": PAYMENT_ID,
        "user_id": TEST_USER_ID,
        "telegram_user_id": 1001,
        "plan_id": PREMIUM_MONTHLY_PLAN,
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tg-charge-1",
        "total_amount": 499,
        "currency": "XTR",
        "subscription_expiration_date": "2026-06-01T00:00:00+00:00",
        "is_recurring": True,
        "is_first_recurring": True,
        "status": "paid",
        "created_at": "2026-05-02T00:00:00+00:00",
        "updated_at": "2026-05-02T00:01:00+00:00",
    }
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        paid_row
    ]
    db.table.return_value.upsert.return_value.execute.return_value.data = []
    payment = TelegramSuccessfulPayment(
        currency="XTR",
        total_amount=499,
        invoice_payload=payload,
        telegram_payment_charge_id="tg-charge-1",
        subscription_expiration_date=expires_at,
        is_recurring=True,
        is_first_recurring=True,
    )

    result = process_successful_payment(
        db,
        telegram_user=TelegramUser(id=1001, first_name="Alex"),
        payment=payment,
        raw_update={"message_id": 1},
    )

    assert result.status == "paid"
    premium_payload = db.table.return_value.upsert.call_args.args[0]
    assert premium_payload["user_id"] == TEST_USER_ID
    assert premium_payload["is_premium"] is True
    assert premium_payload["store"] == "telegram_stars"
    assert premium_payload["expires_at"] == "2026-06-01T00:00:00+00:00"


def test_successful_payment_is_idempotent_for_already_paid_invoice():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    db = MagicMock()
    paid_row = {
        "id": PAYMENT_ID,
        "user_id": TEST_USER_ID,
        "telegram_user_id": 1001,
        "plan_id": PREMIUM_MONTHLY_PLAN,
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tg-charge-1",
        "total_amount": 499,
        "currency": "XTR",
        "subscription_expiration_date": "2026-06-01T00:00:00+00:00",
        "is_recurring": True,
        "is_first_recurring": False,
        "status": "paid",
        "created_at": "2026-05-02T00:00:00+00:00",
        "updated_at": "2026-05-02T00:01:00+00:00",
    }
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        paid_row
    ]
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        paid_row
    ]
    db.table.return_value.upsert.return_value.execute.return_value.data = []
    payment = TelegramSuccessfulPayment(
        currency="XTR",
        total_amount=499,
        invoice_payload=payload,
        telegram_payment_charge_id="tg-charge-1",
        subscription_expiration_date=int(
            datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc).timestamp()
        ),
        is_recurring=True,
    )

    result = process_successful_payment(
        db,
        telegram_user=TelegramUser(id=1001, first_name="Alex"),
        payment=payment,
        raw_update={"message_id": 1},
    )

    assert result.status == "paid"
    db.table.return_value.upsert.assert_called_once()
    premium_payload = db.table.return_value.upsert.call_args.args[0]
    assert premium_payload["is_premium"] is True
    assert premium_payload["store"] == "telegram_stars"


def test_refunded_payment_marks_payment_and_deactivates_telegram_premium():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    payments_table = MagicMock()
    premium_table = MagicMock()
    db = MagicMock()
    db.table.side_effect = {
        "telegram_star_payments": payments_table,
        "user_premium": premium_table,
    }.__getitem__
    paid_row = {
        "id": PAYMENT_ID,
        "user_id": TEST_USER_ID,
        "telegram_user_id": 1001,
        "plan_id": PREMIUM_MONTHLY_PLAN,
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tg-charge-1",
        "total_amount": 499,
        "currency": "XTR",
        "subscription_expiration_date": "2026-06-01T00:00:00+00:00",
        "is_recurring": True,
        "is_first_recurring": True,
        "status": "paid",
        "created_at": "2026-05-02T00:00:00+00:00",
        "updated_at": "2026-05-02T00:01:00+00:00",
    }
    refunded_row = {**paid_row, "status": "refunded"}
    payments_table.select.return_value.eq.return_value.execute.return_value.data = [paid_row]
    payments_table.update.return_value.eq.return_value.execute.return_value.data = [
        refunded_row
    ]
    premium_table.select.return_value.eq.return_value.execute.return_value.data = [
        {"user_id": TEST_USER_ID, "store": "telegram_stars"}
    ]
    premium_table.update.return_value.eq.return_value.execute.return_value.data = []
    refund = TelegramRefundedPayment(
        currency="XTR",
        total_amount=499,
        invoice_payload=payload,
        telegram_payment_charge_id="tg-charge-1",
    )

    result = process_refunded_payment(
        db,
        telegram_user=TelegramUser(id=1001, first_name="Alex"),
        payment=refund,
        raw_update={"message_id": 2},
    )

    assert result.status == "refunded"
    payment_update = payments_table.update.call_args.args[0]
    assert payment_update["status"] == "refunded"
    premium_update = premium_table.update.call_args.args[0]
    assert premium_update["is_premium"] is False
    assert premium_update["store"] == "telegram_stars"


def test_refunded_payment_does_not_deactivate_non_telegram_premium():
    payload = create_invoice_payload(TEST_USER_ID, PREMIUM_MONTHLY_PLAN)
    payments_table = MagicMock()
    premium_table = MagicMock()
    db = MagicMock()
    db.table.side_effect = {
        "telegram_star_payments": payments_table,
        "user_premium": premium_table,
    }.__getitem__
    paid_row = {
        "id": PAYMENT_ID,
        "user_id": TEST_USER_ID,
        "telegram_user_id": 1001,
        "plan_id": PREMIUM_MONTHLY_PLAN,
        "invoice_payload": payload,
        "telegram_payment_charge_id": "tg-charge-1",
        "total_amount": 499,
        "currency": "XTR",
        "subscription_expiration_date": "2026-06-01T00:00:00+00:00",
        "is_recurring": True,
        "is_first_recurring": True,
        "status": "paid",
        "created_at": "2026-05-02T00:00:00+00:00",
        "updated_at": "2026-05-02T00:01:00+00:00",
    }
    payments_table.select.return_value.eq.return_value.execute.return_value.data = [paid_row]
    payments_table.update.return_value.eq.return_value.execute.return_value.data = [
        {**paid_row, "status": "refunded"}
    ]
    premium_table.select.return_value.eq.return_value.execute.return_value.data = [
        {"user_id": TEST_USER_ID, "store": "app_store"}
    ]
    refund = TelegramRefundedPayment(
        currency="XTR",
        total_amount=499,
        invoice_payload=payload,
        telegram_payment_charge_id="tg-charge-1",
    )

    result = process_refunded_payment(
        db,
        telegram_user=TelegramUser(id=1001, first_name="Alex"),
        payment=refund,
    )

    assert result.status == "refunded"
    premium_table.update.assert_not_called()


@pytest.mark.anyio
async def test_refresh_endpoint_returns_current_premium_status(authed_client):
    premium = PremiumStatus(
        is_premium=True,
        entitlement_id="premium",
        expires_at="2026-06-01T00:00:00+00:00",
        period_type="normal",
        store="telegram_stars",
    )
    with patch(
        "api.telegram_payments.refresh_telegram_premium",
        new=AsyncMock(return_value=premium),
    ) as mock_refresh:
        resp = await authed_client.post("/telegram/payments/refresh")

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_premium"] is True
    assert body["store"] == "telegram_stars"
    mock_refresh.assert_awaited_once_with(TEST_USER_ID)
