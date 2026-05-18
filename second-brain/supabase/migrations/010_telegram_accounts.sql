-- Migration 010: Telegram account mapping
-- Maps a Telegram user ID to one internal Supabase auth user.

create table if not exists public.telegram_accounts (
  telegram_user_id bigint primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  photo_url text,
  allows_write_to_pm boolean not null default false,
  last_auth_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_accounts enable row level security;

drop policy if exists telegram_accounts_select_own on public.telegram_accounts;

create policy telegram_accounts_select_own on public.telegram_accounts
  for select using (auth.uid() = user_id);

create index if not exists telegram_accounts_user_id_idx
  on public.telegram_accounts (user_id);

create index if not exists telegram_accounts_username_idx
  on public.telegram_accounts (username)
  where username is not null;

drop trigger if exists set_telegram_accounts_updated_at on public.telegram_accounts;
create trigger set_telegram_accounts_updated_at
  before update on public.telegram_accounts
  for each row execute function public.set_updated_at();
