# Stage 7 - Telegram Stars Premium

## Objective

Replace RevenueCat inside Telegram with Telegram Stars subscriptions while keeping the existing `user_premium` table as the canonical entitlement source.

## Work To Do

- Add Telegram Stars payment table.
- Add invoice creation service.
- Add `POST /telegram/payments/invoice`.
- Use Bot API `createInvoiceLink`.
- Open invoice from Mini App through Telegram SDK.
- Handle webhook `pre_checkout_query`.
- Handle webhook `successful_payment`.
- Store Telegram payment charge ID.
- Upsert existing `user_premium`.
- Add payment refresh endpoint.
- Add refund/cancel handling where available.
- Update paywall UI for Stars.
- Add `/paysupport` support behavior in bot if not already complete.

## Migration

```sql
create table public.telegram_star_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  telegram_user_id bigint not null,
  plan_id text not null,
  invoice_payload text not null unique,
  telegram_payment_charge_id text unique,
  total_amount int,
  currency text check (currency = 'XTR'),
  subscription_expiration_date timestamptz,
  is_recurring boolean default false,
  is_first_recurring boolean default false,
  status text not null default 'pending'
    check (status in ('pending','paid','refunded','failed','cancelled')),
  raw_update jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Backend Files

- `second-brain/backend/api/telegram_payments.py`
- `second-brain/backend/services/telegram_payments.py`
- `second-brain/backend/models/telegram_payment.py`
- `second-brain/backend/tests/test_telegram_payments.py`

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/premium/PremiumScreen.tsx`
- `second-brain/telegram-miniapp/src/services/payments.ts`

## Payment Flow

1. User taps premium CTA.
2. Client calls `POST /telegram/payments/invoice`.
3. Backend creates signed payload and invoice link.
4. Client opens Telegram invoice.
5. Bot webhook receives `pre_checkout_query`.
6. Backend validates payload and answers pre-checkout quickly.
7. Bot webhook receives `successful_payment`.
8. Backend stores payment row and upserts `user_premium`.
9. Client refreshes `GET /premium/status`.
10. Premium UI unlocks.

## Tests

- Invoice payload is unique and tied to current user.
- Invoice creation uses `XTR`.
- Subscription period is 30 days.
- Pre-checkout rejects invalid payload.
- Pre-checkout accepts valid pending invoice.
- Successful payment activates premium.
- Repeated successful payment update is idempotent.
- Payment refresh returns active premium.
- Refund/cancel deactivates premium if no other active entitlement exists.

## Acceptance Criteria

- Telegram users can buy premium inside Telegram only through Stars.
- Native mobile RevenueCat flow remains unchanged.
- Backend premium policy uses one canonical status.
- Free/premium gates immediately reflect Stars purchase.
