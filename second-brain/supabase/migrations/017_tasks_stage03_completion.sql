-- 017_tasks_stage03_completion.sql
-- Complete Stage 03 backend contracts: delegation, focus settings, recurrence idempotency, project templates.

begin;

alter table public.tasks add column if not exists assignee_name text;
alter table public.tasks add column if not exists assignee_contact text;
alter table public.tasks add column if not exists delegated_at timestamptz;
alter table public.tasks add column if not exists delegation_status text;
alter table public.tasks add column if not exists recurrence_instance_key text;

alter table public.tasks drop constraint if exists tasks_delegation_status_check;
alter table public.tasks
  add constraint tasks_delegation_status_check
  check (
    delegation_status is null
    or delegation_status in ('delegated','accepted','declined','done')
  );

create table if not exists public.task_focus_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  pomodoro_min int not null default 25 check (pomodoro_min between 1 and 180),
  short_break_min int not null default 5 check (short_break_min between 1 and 60),
  long_break_min int not null default 15 check (long_break_min between 1 and 120),
  sessions_before_long_break int not null default 4 check (sessions_before_long_break between 1 and 12),
  sound_enabled boolean not null default true,
  dnd_enabled boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.task_focus_settings enable row level security;
drop policy if exists "users_own_task_focus_settings" on public.task_focus_settings;
create policy "users_own_task_focus_settings" on public.task_focus_settings
  for all using (auth.uid() = user_id);

create table if not exists public.task_project_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  goal_id uuid references public.goals(id) on delete set null,
  deadline date,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.task_project_templates enable row level security;
drop policy if exists "users_own_task_project_templates" on public.task_project_templates;
create policy "users_own_task_project_templates" on public.task_project_templates
  for all using (auth.uid() = user_id);

create index if not exists tasks_status_project_idx on public.tasks (user_id, status, project_id);
create index if not exists tasks_deadline_idx on public.tasks (user_id, deadline) where deadline is not null;
create index if not exists tasks_context_idx on public.tasks (user_id, context) where context is not null;
create index if not exists tasks_tags_gin_idx on public.tasks using gin (tags);
create index if not exists tasks_habit_idx on public.tasks (user_id, habit_mode, next_occurrence_at);
create unique index if not exists tasks_recurrence_instance_key_idx
  on public.tasks (user_id, recurrence_instance_key)
  where recurrence_instance_key is not null;

drop trigger if exists task_focus_settings_updated_at on public.task_focus_settings;
create trigger task_focus_settings_updated_at
  before update on public.task_focus_settings
  for each row execute function public.set_updated_at();

drop trigger if exists task_project_templates_updated_at on public.task_project_templates;
create trigger task_project_templates_updated_at
  before update on public.task_project_templates
  for each row execute function public.set_updated_at();

commit;
