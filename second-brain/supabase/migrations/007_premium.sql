-- Migration 007: Premium Subscription (RevenueCat)

-- 1. user_premium table
create table public.user_premium (
  user_id uuid primary key references auth.users(id) on delete cascade not null,
  is_premium boolean not null default false,
  entitlement_id text,
  product_id text,
  period_type text check (period_type in ('normal', 'trial', 'intro')),
  purchase_date timestamptz,
  expires_at timestamptz,
  store text check (store in ('app_store', 'play_store', 'stripe', 'promotional')),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 2. Row Level Security — users can only SELECT their own row; writes are service-role only
alter table public.user_premium enable row level security;

create policy "users_select_own_premium" on public.user_premium
  for select using (auth.uid() = user_id);

-- 3. Indexes
create index user_premium_user_id_idx on public.user_premium (user_id);
create index user_premium_expires_at_idx on public.user_premium (expires_at)
  where expires_at is not null;

-- 4. updated_at trigger (reuses set_updated_at from migration 001)
create trigger set_user_premium_updated_at
  before update on public.user_premium
  for each row execute function public.set_updated_at();
