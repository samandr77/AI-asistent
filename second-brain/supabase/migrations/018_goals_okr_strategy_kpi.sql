-- Migration 018: OKR hierarchy + Key Results + Strategy + KPI tracker + Weekly Review
-- Stage 02 (Control Center) — full functionality for the Goals section.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend goals: level (life|year|quarter|week), parent_goal_id, horizon, sphere
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.goals
  add column if not exists level text not null default 'year'
    check (level in ('life','year','quarter','week'));

alter table public.goals
  add column if not exists parent_goal_id uuid references public.goals(id) on delete set null;

alter table public.goals
  add column if not exists horizon_start date;

alter table public.goals
  add column if not exists horizon_end date;

alter table public.goals
  add column if not exists weight int not null default 1
    check (weight >= 1 and weight <= 10);

-- Expand sphere set so Goals can live in any sphere (mind = personal growth)
alter table public.goals
  drop constraint if exists goals_sphere_check;

alter table public.goals
  add constraint goals_sphere_check
  check (sphere in ('work','family','study','health','travel','finance','goals','mind','personal'));

create index if not exists goals_user_level_idx on public.goals (user_id, level);
create index if not exists goals_parent_idx on public.goals (parent_goal_id) where parent_goal_id is not null;
create index if not exists goals_user_horizon_idx on public.goals (user_id, horizon_start, horizon_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Key Results — measurable outcomes attached to a goal
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.goal_key_results (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references public.goals(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  metric text,
  unit text,
  start_value numeric not null default 0,
  target_value numeric not null,
  current_value numeric not null default 0,
  direction text not null default 'increase'
    check (direction in ('increase','decrease','maintain')),
  status text not null default 'on_track'
    check (status in ('on_track','at_risk','off_track','done')),
  due_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.goal_key_results enable row level security;

create policy "users_own_key_results" on public.goal_key_results
  for all using (auth.uid() = user_id);

create index if not exists goal_kr_goal_idx on public.goal_key_results (goal_id);
create index if not exists goal_kr_user_idx on public.goal_key_results (user_id);

create trigger goal_key_results_updated_at
  before update on public.goal_key_results
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Strategy: mission + values + life areas + SWOT
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_strategy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mission text,
  vision text,
  values jsonb not null default '[]'::jsonb,
  life_areas jsonb not null default '[]'::jsonb,
  swot_strengths jsonb not null default '[]'::jsonb,
  swot_weaknesses jsonb not null default '[]'::jsonb,
  swot_opportunities jsonb not null default '[]'::jsonb,
  swot_threats jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_strategy enable row level security;

create policy "users_own_strategy" on public.user_strategy
  for all using (auth.uid() = user_id);

create trigger user_strategy_updated_at
  before update on public.user_strategy
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. KPI tracker: user-chosen metrics + history
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_kpis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  unit text,
  sphere text,
  target_value numeric,
  current_value numeric,
  direction text not null default 'increase'
    check (direction in ('increase','decrease','maintain')),
  warning_threshold numeric,
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_kpis enable row level security;

create policy "users_own_kpis" on public.user_kpis
  for all using (auth.uid() = user_id);

create index if not exists user_kpis_user_idx on public.user_kpis (user_id, is_active);

create trigger user_kpis_updated_at
  before update on public.user_kpis
  for each row execute function public.set_updated_at();

create table if not exists public.user_kpi_history (
  id uuid default gen_random_uuid() primary key,
  kpi_id uuid references public.user_kpis(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  recorded_on date not null default current_date,
  value numeric not null,
  note text,
  created_at timestamptz default now() not null
);

alter table public.user_kpi_history enable row level security;

create policy "users_own_kpi_history" on public.user_kpi_history
  for all using (auth.uid() = user_id);

create index if not exists user_kpi_history_kpi_date_idx
  on public.user_kpi_history (kpi_id, recorded_on desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Weekly review — review of OKR progress, completed tasks, next-week plan
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.weekly_reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  highlights text,
  lessons text,
  next_week_focus text,
  okr_progress jsonb not null default '{}'::jsonb,
  completed_tasks_count int not null default 0,
  carried_over_count int not null default 0,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create policy "users_own_weekly_reviews" on public.weekly_reviews
  for all using (auth.uid() = user_id);

create index if not exists weekly_reviews_user_week_idx
  on public.weekly_reviews (user_id, week_start desc);

create trigger weekly_reviews_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();
