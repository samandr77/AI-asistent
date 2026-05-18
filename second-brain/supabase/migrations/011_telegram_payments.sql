-- Migration 011: Telegram Stars payments
-- Tracks invoice creation and successful Stars payment updates.

create table if not exists public.telegram_star_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  telegram_user_id bigint not null,
  plan_id text not null check (plan_id in ('premium_monthly')),
  invoice_payload text not null unique,
  telegram_payment_charge_id text unique,
  total_amount integer check (total_amount is null or total_amount >= 0),
  currency text check (currency is null or currency = 'XTR'),
  subscription_expiration_date timestamptz,
  is_recurring boolean not null default false,
  is_first_recurring boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','paid','refunded','failed','cancelled')),
  raw_update jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_star_payments enable row level security;

drop policy if exists telegram_star_payments_select_own on public.telegram_star_payments;

create policy telegram_star_payments_select_own on public.telegram_star_payments
  for select using (auth.uid() = user_id);

create index if not exists telegram_star_payments_user_idx
  on public.telegram_star_payments (user_id, created_at desc);

create index if not exists telegram_star_payments_charge_idx
  on public.telegram_star_payments (telegram_payment_charge_id)
  where telegram_payment_charge_id is not null;

create index if not exists telegram_star_payments_status_idx
  on public.telegram_star_payments (status, created_at desc);

drop trigger if exists set_telegram_star_payments_updated_at on public.telegram_star_payments;
create trigger set_telegram_star_payments_updated_at
  before update on public.telegram_star_payments
  for each row execute function public.set_updated_at();
