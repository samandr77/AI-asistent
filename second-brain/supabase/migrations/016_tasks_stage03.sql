-- 016_tasks_stage03.sql
-- Full Stage 03 task backend contracts: planning, projects, recurrence, focus, filters, analytics.

begin;

-- 1. Expand tasks into productivity objects. Keep every column additive for compatibility.
alter table public.tasks add column if not exists context text;
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists eisenhower_quadrant text;
alter table public.tasks add column if not exists scheduled_start timestamptz;
alter table public.tasks add column if not exists scheduled_end timestamptz;
alter table public.tasks add column if not exists duration_estimated_min int;
alter table public.tasks add column if not exists duration_actual_min int not null default 0;
alter table public.tasks add column if not exists deep_work boolean not null default false;
alter table public.tasks add column if not exists project_id uuid;
alter table public.tasks add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;
alter table public.tasks add column if not exists recurrence_rule jsonb;
alter table public.tasks add column if not exists next_occurrence_at timestamptz;
alter table public.tasks add column if not exists habit_mode boolean not null default false;
alter table public.tasks add column if not exists rollover_count int not null default 0;
alter table public.tasks add column if not exists source text not null default 'manual';
alter table public.tasks add column if not exists parser_metadata jsonb not null default '{}';

alter table public.tasks drop constraint if exists tasks_eisenhower_quadrant_check;
alter table public.tasks
  add constraint tasks_eisenhower_quadrant_check
  check (
    eisenhower_quadrant is null
    or eisenhower_quadrant in ('do_now','schedule','delegate','delete')
  );

alter table public.tasks drop constraint if exists tasks_source_check;
alter table public.tasks
  add constraint tasks_source_check
  check (source in ('manual','telegram','voice','browser','email','whatsapp','linear','asana','notion'));

alter table public.tasks drop constraint if exists tasks_duration_estimated_check;
alter table public.tasks
  add constraint tasks_duration_estimated_check
  check (duration_estimated_min is null or duration_estimated_min between 1 and 1440);

alter table public.tasks drop constraint if exists tasks_duration_actual_check;
alter table public.tasks
  add constraint tasks_duration_actual_check
  check (duration_actual_min >= 0 and duration_actual_min <= 1440);

-- 2. Projects.
create table if not exists public.task_projects (
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
alter table public.task_projects enable row level security;
drop policy if exists "users_own_task_projects" on public.task_projects;
create policy "users_own_task_projects" on public.task_projects
  for all using (auth.uid() = user_id);

alter table public.tasks drop constraint if exists tasks_project_id_fkey;
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id) references public.task_projects(id) on delete set null;

-- 3. Dependencies, checklist, comments, attachments.
create table if not exists public.task_dependencies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  depends_on_task_id uuid references public.tasks(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (task_id, depends_on_task_id)
);
alter table public.task_dependencies enable row level security;
drop policy if exists "users_own_task_dependencies" on public.task_dependencies;
create policy "users_own_task_dependencies" on public.task_dependencies
  for all using (auth.uid() = user_id);

create table if not exists public.task_checklist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.task_checklist_items enable row level security;
drop policy if exists "users_own_task_checklist_items" on public.task_checklist_items;
create policy "users_own_task_checklist_items" on public.task_checklist_items
  for all using (auth.uid() = user_id);

create table if not exists public.task_comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now() not null
);
alter table public.task_comments enable row level security;
drop policy if exists "users_own_task_comments" on public.task_comments;
create policy "users_own_task_comments" on public.task_comments
  for all using (auth.uid() = user_id);

create table if not exists public.task_attachments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  kind text not null check (kind in ('link','file')),
  url text not null,
  title text,
  created_at timestamptz default now() not null
);
alter table public.task_attachments enable row level security;
drop policy if exists "users_own_task_attachments" on public.task_attachments;
create policy "users_own_task_attachments" on public.task_attachments
  for all using (auth.uid() = user_id);

-- 4. Planning/focus/filter/report tables.
create table if not exists public.task_big_three (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  position int not null check (position between 1 and 3),
  created_at timestamptz default now() not null,
  unique (user_id, date, position),
  unique (user_id, date, task_id)
);
alter table public.task_big_three enable row level security;
drop policy if exists "users_own_task_big_three" on public.task_big_three;
create policy "users_own_task_big_three" on public.task_big_three
  for all using (auth.uid() = user_id);

create table if not exists public.task_focus_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int not null check (duration_min between 1 and 1440),
  mode text not null default 'pomodoro',
  completed boolean not null default true,
  created_at timestamptz default now() not null
);
alter table public.task_focus_sessions enable row level security;
drop policy if exists "users_own_task_focus_sessions" on public.task_focus_sessions;
create policy "users_own_task_focus_sessions" on public.task_focus_sessions
  for all using (auth.uid() = user_id);

create table if not exists public.task_saved_filters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  definition jsonb not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.task_saved_filters enable row level security;
drop policy if exists "users_own_task_saved_filters" on public.task_saved_filters;
create policy "users_own_task_saved_filters" on public.task_saved_filters
  for all using (auth.uid() = user_id);

create table if not exists public.task_weekly_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  summary jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  created_at timestamptz default now() not null,
  unique (user_id, week_start)
);
alter table public.task_weekly_reports enable row level security;
drop policy if exists "users_own_task_weekly_reports" on public.task_weekly_reports;
create policy "users_own_task_weekly_reports" on public.task_weekly_reports
  for all using (auth.uid() = user_id);

-- 5. Hot-path indexes.
create index if not exists tasks_project_idx on public.tasks (user_id, project_id) where project_id is not null;
create index if not exists tasks_parent_idx on public.tasks (user_id, parent_task_id) where parent_task_id is not null;
create index if not exists tasks_scheduled_idx on public.tasks (user_id, scheduled_start) where scheduled_start is not null;
create index if not exists tasks_recurrence_idx on public.tasks (user_id, next_occurrence_at) where recurrence_rule is not null;
create index if not exists tasks_eisenhower_idx on public.tasks (user_id, eisenhower_quadrant) where is_done = false;
create index if not exists task_projects_user_status_idx on public.task_projects (user_id, status);
create index if not exists task_checklist_task_idx on public.task_checklist_items (task_id, position);
create index if not exists task_focus_task_idx on public.task_focus_sessions (task_id, started_at desc);
create index if not exists task_big_three_user_date_idx on public.task_big_three (user_id, date, position);

-- 6. updated_at triggers.
drop trigger if exists task_projects_updated_at on public.task_projects;
create trigger task_projects_updated_at
  before update on public.task_projects
  for each row execute function public.set_updated_at();

drop trigger if exists task_checklist_items_updated_at on public.task_checklist_items;
create trigger task_checklist_items_updated_at
  before update on public.task_checklist_items
  for each row execute function public.set_updated_at();

drop trigger if exists task_saved_filters_updated_at on public.task_saved_filters;
create trigger task_saved_filters_updated_at
  before update on public.task_saved_filters
  for each row execute function public.set_updated_at();

commit;
