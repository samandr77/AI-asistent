-- Migration 021: Sleep tracking core sessions, goals, and v1 score inputs

alter table public.health_sleep_logs
  add column if not exists bedtime_at timestamptz,
  add column if not exists wake_at timestamptz,
  add column if not exists source text not null default 'manual';

create table if not exists public.health_sleep_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  source text not null default 'manual',
  sleep_log_id uuid references public.health_sleep_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists health_sleep_sessions_one_active_idx
  on public.health_sleep_sessions (user_id)
  where status = 'active';

create table if not exists public.health_sleep_goals (
  user_id uuid references auth.users(id) on delete cascade primary key,
  target_duration_minutes int not null default 480
    check (target_duration_minutes between 240 and 720),
  target_bedtime text,
  target_wake_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_sleep_sessions enable row level security;
alter table public.health_sleep_goals enable row level security;

drop policy if exists "users_own_health_sleep_sessions" on public.health_sleep_sessions;
create policy "users_own_health_sleep_sessions" on public.health_sleep_sessions
  for all using (auth.uid() = user_id);

drop policy if exists "users_own_health_sleep_goals" on public.health_sleep_goals;
create policy "users_own_health_sleep_goals" on public.health_sleep_goals
  for all using (auth.uid() = user_id);

create index if not exists health_sleep_logs_user_bedtime_idx
  on public.health_sleep_logs (user_id, bedtime_at desc);
create index if not exists health_sleep_sessions_user_started_idx
  on public.health_sleep_sessions (user_id, started_at desc);

drop trigger if exists set_health_sleep_sessions_updated_at on public.health_sleep_sessions;
create trigger set_health_sleep_sessions_updated_at
  before update on public.health_sleep_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_health_sleep_goals_updated_at on public.health_sleep_goals;
create trigger set_health_sleep_goals_updated_at
  before update on public.health_sleep_goals
  for each row execute function public.set_updated_at();
