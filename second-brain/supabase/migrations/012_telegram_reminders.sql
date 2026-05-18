-- Migration 012: Telegram reminder settings
-- Stores bot reminder preferences for reflection and morning planning flows.

create table if not exists public.telegram_reminder_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  telegram_user_id bigint not null,
  daily_reflection_enabled boolean not null default true,
  daily_reflection_time text not null default '21:00'
    check (daily_reflection_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  morning_enabled boolean not null default false,
  morning_time text not null default '09:00'
    check (morning_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text,
  last_daily_reflection_sent_for date,
  last_morning_sent_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_reminder_settings enable row level security;

drop policy if exists telegram_reminder_settings_own on public.telegram_reminder_settings;

create policy telegram_reminder_settings_own on public.telegram_reminder_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists telegram_reminder_settings_daily_idx
  on public.telegram_reminder_settings (daily_reflection_enabled, daily_reflection_time);

create index if not exists telegram_reminder_settings_morning_idx
  on public.telegram_reminder_settings (morning_enabled, morning_time);

drop trigger if exists set_telegram_reminder_settings_updated_at on public.telegram_reminder_settings;
create trigger set_telegram_reminder_settings_updated_at
  before update on public.telegram_reminder_settings
  for each row execute function public.set_updated_at();

create or replace function public.cascade_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.telegram_reminder_settings where user_id = p_user_id;
  delete from public.telegram_star_payments where user_id = p_user_id;
  delete from public.telegram_accounts where user_id = p_user_id;
  delete from public.daily_reflections where user_id = p_user_id;
  delete from public.tasks where user_id = p_user_id;
  delete from public.goals where user_id = p_user_id;
  delete from public.dumps where user_id = p_user_id;
  delete from public.user_ai_usage where user_id = p_user_id;
  delete from public.user_premium where user_id = p_user_id;
  delete from public.user_profiles where id = p_user_id;
  -- auth.users cleanup is done by the caller via supabase.auth.admin.delete_user()
  -- since it requires service-role privileges on the auth schema.
end;
$$;

revoke all on function public.cascade_delete_user(uuid) from public, anon, authenticated;
