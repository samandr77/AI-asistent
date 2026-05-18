-- Migration 009: Account deletion (soft-delete + cascade cleanup)
-- Adds user_profiles.deleted_at + partial index, tightens RLS to hide soft-deleted
-- rows from the owner, and creates a service-role-only RPC that purges all
-- user-owned rows in dependency order.

-- 1. Soft-delete column + partial index
alter table public.user_profiles
  add column if not exists deleted_at timestamptz;

create index if not exists idx_user_profiles_deleted_at
  on public.user_profiles (deleted_at)
  where deleted_at is not null;

-- 2. Tighten RLS policies on user_profiles — owners can see their row only when not soft-deleted.
--    The original migration 001 used a single FOR ALL policy ("users_own_profile"). We split it
--    into SELECT / UPDATE / INSERT / DELETE so SELECT alone is gated by deleted_at.
drop policy if exists "users_own_profile" on public.user_profiles;
drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_delete_own on public.user_profiles;

create policy user_profiles_select_own on public.user_profiles
  for select using (auth.uid() = id and deleted_at is null);

create policy user_profiles_update_own on public.user_profiles
  for update using (auth.uid() = id and deleted_at is null);

create policy user_profiles_insert_own on public.user_profiles
  for insert with check (auth.uid() = id);

create policy user_profiles_delete_own on public.user_profiles
  for delete using (auth.uid() = id);

-- 3. Cascade cleanup RPC — service-role only. Deletes all user-owned rows in dependency order.
create or replace function public.cascade_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
-- Callable only by service_role.

-- 4. Supporting index for tasks history cutoff (US2). Partial on non-done for main queries.
create index if not exists idx_tasks_user_created
  on public.tasks (user_id, created_at desc);
