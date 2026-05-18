-- Migration 006: Evening Reflection

-- 1. Add completed_at to tasks for tracking when tasks were completed
alter table public.tasks
  add column if not exists completed_at timestamptz;

-- 2. daily_reflections table
create table public.daily_reflections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  mood int not null check (mood >= 1 and mood <= 5),
  energy int not null check (energy >= 1 and energy <= 5),
  notes text check (char_length(notes) <= 4000),
  completed_count int not null default 0,
  goal_aligned_count int not null default 0,
  active_goal_ids uuid[] not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint daily_reflections_user_date_unique unique (user_id, date)
);

alter table public.daily_reflections enable row level security;

create policy "users_own_reflections" on public.daily_reflections
  for all using (auth.uid() = user_id);

create index reflections_user_date_idx on public.daily_reflections (user_id, date desc);

-- updated_at trigger (reuses set_updated_at from migration 001)
create trigger reflections_updated_at
  before update on public.daily_reflections
  for each row execute function public.set_updated_at();
