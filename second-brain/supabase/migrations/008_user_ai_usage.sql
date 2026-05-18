-- 008_user_ai_usage.sql — per-user daily AI token budget accounting
-- Supports reliability plan Task 3. Service-role writes via add_ai_tokens RPC.

create table if not exists public.user_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  total_tokens integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.user_ai_usage enable row level security;

create policy "user_ai_usage_select_own" on public.user_ai_usage
  for select using (auth.uid() = user_id);

create policy "user_ai_usage_write_service_role" on public.user_ai_usage
  for all using (auth.role() = 'service_role');

create or replace function public.add_ai_tokens(p_user_id uuid, p_tokens int)
returns int
language plpgsql
security definer
as $$
declare
  v_total int;
begin
  insert into public.user_ai_usage(user_id, total_tokens)
  values (p_user_id, p_tokens)
  on conflict (user_id, usage_date) do update
    set total_tokens = public.user_ai_usage.total_tokens + excluded.total_tokens,
        updated_at = now()
  returning total_tokens into v_total;
  return v_total;
end
$$;
