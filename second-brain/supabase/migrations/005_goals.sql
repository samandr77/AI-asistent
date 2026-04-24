-- Migration 005: Goals as first-class entity

-- 1. Extend tasks sphere enum to 7 spheres (finance + goals added)
alter table public.tasks
  drop constraint if exists tasks_sphere_check;

alter table public.tasks
  add constraint tasks_sphere_check
  check (sphere in ('work','family','study','health','travel','finance','goals'));

-- 2. Goals table
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active'
    check (status in ('active','paused','achieved','archived')),
  sphere text
    check (sphere in ('work','family','study','health','travel','finance','goals')),
  progress_percent int not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.goals enable row level security;

create policy "users_own_goals" on public.goals
  for all using (auth.uid() = user_id);

create index goals_user_status_idx on public.goals (user_id, status);
create index goals_user_target_date_idx on public.goals (user_id, target_date);

-- updated_at trigger for goals
create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- 3. Add goal_id FK to tasks
alter table public.tasks
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index tasks_goal_id_idx on public.tasks (goal_id) where goal_id is not null;
