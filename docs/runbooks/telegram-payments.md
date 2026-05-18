# Runbook: Telegram Stars Payments

## Purpose

Operate Premium purchases inside Telegram using Telegram Stars while keeping
`user_premium` as the canonical entitlement table.

## Configuration

- `TELEGRAM_BOT_TOKEN`: bot used to create invoice links and answer checkout.
- `TELEGRAM_PREMIUM_MONTHLY_STARS`: monthly price, default `499`.
- `TELEGRAM_WEBHOOK_SECRET`: required for payment updates through `/telegram/webhook`.
- `APP_SESSION_JWT_SECRET`: signs invoice payloads.

## Flow

1. Mini App calls `POST /telegram/payments/invoice`.
2. Backend inserts `telegram_star_payments.status='pending'`.
3. Backend calls Telegram Bot API `createInvoiceLink` with `currency='XTR'`.
4. Mini App opens the invoice with `Telegram.WebApp.openInvoice`.
5. Telegram sends `pre_checkout_query`; backend validates payload, amount, user, and answers immediately.
6. Telegram sends `successful_payment`; backend stores `telegram_payment_charge_id` and upserts `user_premium`.
7. Client calls `POST /telegram/payments/refresh` or `GET /premium/status`.

## Verification

```sql
select status, currency, total_amount, telegram_payment_charge_id
from public.telegram_star_payments
order by created_at desc
limit 5;
```

Expected successful row:

- `status = 'paid'`
- `currency = 'XTR'`
- `telegram_payment_charge_id` is not null

```sql
select is_premium, store, expires_at
from public.user_premium
where user_id = '<user uuid>';
```

Expected:

- `is_premium = true`
- `store = 'telegram_stars'`
- `expires_at` is in the future

## Failure Modes

| Symptom | Likely cause | Action |
| --- | --- | --- |
| invoice endpoint 404 | user has no `telegram_accounts` row | Reopen Mini App through Telegram auth |
| pre-checkout rejected | payload/amount/user mismatch | Check `telegram_star_payments` pending row |
| payment succeeds but Premium stays free | successful payment webhook missing | Check Telegram webhook secret and backend logs |
| DB rejects `telegram_stars` store | migration 013 missing | Apply `013_telegram_premium_store.sql` |

## Refunds and cancellations

First release records successful payments and expires entitlement by
`expires_at`. Manual refund/cancel operations must be handled through support
until Telegram refund automation is wired. If a refund is granted, update
`user_premium` and `telegram_star_payments.status` manually with service-role
access, then document the support ticket ID.
