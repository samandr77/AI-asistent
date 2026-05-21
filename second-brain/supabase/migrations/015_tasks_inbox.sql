-- 015_tasks_inbox.sql
-- Phase 1 of Tasks roadmap (spec 006-tasks-capture-inbox):
-- Add status enum + raw_text to tasks; expand sphere CHECK; partial indices.

begin;

-- 1. Expand sphere CHECK to include 'finance' and 'goals' (Python enum already had them).
alter table public.tasks drop constraint if exists tasks_sphere_check;
alter table public.tasks
  add constraint tasks_sphere_check
  check (sphere is null or sphere in ('work','family','study','health','travel','finance','goals'));

-- 2. status column: nullable first, backfill, then NOT NULL + CHECK.
alter table public.tasks add column if not exists status text;

update public.tasks
set status = case when is_done then 'done' else 'active' end
where status is null;

alter table public.tasks alter column status set not null;
alter table public.tasks alter column status set default 'active';
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('inbox','active','done','archived','delegated'));

-- 3. raw_text column (per-task slice of the original user text).
alter table public.tasks add column if not exists raw_text text;

-- 4. Partial indices for hot paths.
create index if not exists tasks_status_idx
  on public.tasks (user_id, status)
  where status <> 'done';

create index if not exists tasks_inbox_idx
  on public.tasks (user_id, created_at desc)
  where status = 'inbox';

commit;

-- Rollback (manual, run if needed):
-- begin;
-- drop index if exists tasks_inbox_idx;
-- drop index if exists tasks_status_idx;
-- alter table public.tasks drop column if exists raw_text;
-- alter table public.tasks drop constraint if exists tasks_status_check;
-- alter table public.tasks drop column if exists status;
-- alter table public.tasks drop constraint if exists tasks_sphere_check;
-- alter table public.tasks add constraint tasks_sphere_check
--   check (sphere in ('work','family','study','health','travel'));
-- commit;
