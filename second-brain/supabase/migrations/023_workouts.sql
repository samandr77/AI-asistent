-- Migration 023: Workouts / Training module (009-workouts feature)
--
-- Adds full strength + multi-sport training stack on top of legacy
-- `health_workouts` (kept for backwards compat via legacy_workout_mirror trigger):
--   * health_exercises             — exercise library (system + custom)
--   * health_workout_sessions      — sessions log (strength + sports, no GPS v1)
--   * health_workout_sets          — per-set logging (reps, weight, rir, ...)
--   * health_workout_supersets     — superset / dropset / circuit grouping
--   * health_workout_programs      — programs (system templates + user-created + AI-generated)
--   * health_workout_program_sessions     — sessions inside program
--   * health_workout_program_exercises    — exercises inside program-session
--   * health_workout_one_rm_history       — per-exercise 1RM history
--   * health_workout_personal_records     — PR detection log
--   * health_user_training_profile        — singleton per user (max_hr, equipment, vo2max, ...)
--
-- All user-owned tables: RLS auth.uid() = user_id, set_updated_at trigger.
-- Library + programs allow NULL user_id for system rows (visible to everyone).

-- ============================================================
-- 1. Exercise library (system + custom)
-- ============================================================
create table public.health_exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null,
  name_ru text not null,
  name_en text,
  primary_muscle text not null
    check (primary_muscle in (
      'chest', 'back', 'lats', 'traps', 'delts_front', 'delts_side', 'delts_rear',
      'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes',
      'calves', 'abs', 'obliques', 'lower_back', 'neck', 'full_body'
    )),
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  category text not null
    check (category in ('strength', 'cardio', 'stretching', 'plyometric', 'mobility')),
  is_compound boolean not null default false,
  is_unilateral boolean not null default false,
  default_rest_seconds int check (default_rest_seconds is null or default_rest_seconds between 0 and 600),
  tempo_default text,
  instructions text,
  gif_url text,
  video_url text,
  thumbnail_url text,
  difficulty text check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced')),
  sport_kind text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slug unique per scope: globally unique for system rows, unique per user for custom
create unique index health_exercises_system_slug_uniq
  on public.health_exercises (slug) where user_id is null;
create unique index health_exercises_user_slug_uniq
  on public.health_exercises (user_id, slug) where user_id is not null;
create index health_exercises_primary_muscle_idx
  on public.health_exercises (primary_muscle);
create index health_exercises_category_idx
  on public.health_exercises (category);
create index health_exercises_sport_kind_idx
  on public.health_exercises (sport_kind) where sport_kind is not null;
create index health_exercises_equipment_gin
  on public.health_exercises using gin (equipment);
create index health_exercises_secondary_gin
  on public.health_exercises using gin (secondary_muscles);

-- ============================================================
-- 2. Workout sessions (replaces minimal legacy health_workouts)
-- ============================================================
create table public.health_workout_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  session_type text not null default 'strength'
    check (session_type in ('strength', 'hypertrophy', 'endurance', 'hiit', 'cardio', 'mobility', 'sport')),
  sport_kind text,
  title text not null,
  location text,
  occurred_on date not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  rpe int check (rpe is null or rpe between 1 and 10),
  mood_before int check (mood_before is null or mood_before between 1 and 10),
  mood_after int check (mood_after is null or mood_after between 1 and 10),
  energy_before int check (energy_before is null or energy_before between 1 and 10),
  energy_after int check (energy_after is null or energy_after between 1 and 10),
  training_load_score numeric(10, 2) check (training_load_score is null or training_load_score >= 0),
  intensity_minutes int check (intensity_minutes is null or intensity_minutes >= 0),
  calories int check (calories is null or calories >= 0),
  program_session_id uuid,
  program_id uuid,
  goal_id uuid references public.goals(id) on delete set null,
  source text not null default 'manual'
    check (source in ('manual', 'dump', 'voice', 'photo', 'program', 'import')),
  raw_text text,
  weather_conditions jsonb,
  is_completed boolean not null default false,
  is_planned boolean not null default false,
  planned_for date,
  notes text,
  -- Outdoor / sport-specific manual fields (no GPS v1)
  distance_km numeric(8, 3) check (distance_km is null or distance_km >= 0),
  avg_pace_per_km_seconds int check (avg_pace_per_km_seconds is null or avg_pace_per_km_seconds > 0),
  elevation_gain_m int check (elevation_gain_m is null or elevation_gain_m >= 0),
  max_speed_kmh numeric(6, 2) check (max_speed_kmh is null or max_speed_kmh >= 0),
  vertical_descent_m int check (vertical_descent_m is null or vertical_descent_m >= 0),
  cadence_avg int check (cadence_avg is null or cadence_avg >= 0),
  stroke_rate int check (stroke_rate is null or stroke_rate >= 0),
  swolf int check (swolf is null or swolf >= 0),
  pool_length_m int check (pool_length_m is null or pool_length_m in (25, 33, 50)),
  laps int check (laps is null or laps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_workout_sessions_user_date_idx
  on public.health_workout_sessions (user_id, occurred_on desc);
create index health_workout_sessions_planned_idx
  on public.health_workout_sessions (user_id, is_completed, planned_for)
  where is_planned is true;
create index health_workout_sessions_goal_idx
  on public.health_workout_sessions (goal_id) where goal_id is not null;
create index health_workout_sessions_program_idx
  on public.health_workout_sessions (program_id) where program_id is not null;
create index health_workout_sessions_sport_idx
  on public.health_workout_sessions (sport_kind) where sport_kind is not null;
create index health_workout_sessions_active_idx
  on public.health_workout_sessions (user_id, started_at)
  where ended_at is null and is_completed = false and started_at is not null;

-- ============================================================
-- 3. Workout sets
-- ============================================================
create table public.health_workout_sets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references public.health_workout_sessions(id) on delete cascade not null,
  exercise_id uuid references public.health_exercises(id) on delete restrict not null,
  set_number int not null check (set_number > 0),
  reps int check (reps is null or reps >= 0),
  weight_kg numeric(7, 2) check (weight_kg is null or weight_kg >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  rir int check (rir is null or rir between 0 and 10),
  rpe int check (rpe is null or rpe between 1 and 10),
  tempo text,
  is_warmup boolean not null default false,
  is_dropset boolean not null default false,
  dropset_group int,
  superset_id uuid,
  rest_seconds_actual int check (rest_seconds_actual is null or rest_seconds_actual >= 0),
  distance_m numeric(10, 2) check (distance_m is null or distance_m >= 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_workout_sets_session_idx
  on public.health_workout_sets (session_id, set_number);
create index health_workout_sets_user_exercise_idx
  on public.health_workout_sets (user_id, exercise_id, completed_at desc nulls last);
create index health_workout_sets_superset_idx
  on public.health_workout_sets (superset_id) where superset_id is not null;

-- ============================================================
-- 4. Supersets / dropsets / circuits grouping
-- ============================================================
create table public.health_workout_supersets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references public.health_workout_sessions(id) on delete cascade not null,
  group_index int not null check (group_index >= 0),
  kind text not null default 'superset'
    check (kind in ('superset', 'giantset', 'circuit', 'dropset')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, group_index)
);

create index health_workout_supersets_session_idx
  on public.health_workout_supersets (session_id);

-- ============================================================
-- 5. Workout programs (system + user + AI-generated)
-- ============================================================
create table public.health_workout_programs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal_type text not null default 'general'
    check (goal_type in ('strength', 'hypertrophy', 'cutting', 'endurance', 'general', 'sport_specific')),
  level text not null default 'beginner'
    check (level in ('beginner', 'intermediate', 'advanced')),
  weeks int not null default 4 check (weeks between 1 and 52),
  sessions_per_week int not null default 3 check (sessions_per_week between 1 and 14),
  equipment_required text[] not null default '{}',
  created_by_ai boolean not null default false,
  source_goal_id uuid references public.goals(id) on delete set null,
  ai_model text,
  raw_text text,
  is_published boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_workout_programs_user_idx
  on public.health_workout_programs (user_id) where user_id is not null;
create index health_workout_programs_system_idx
  on public.health_workout_programs (is_published) where user_id is null;
create index health_workout_programs_goal_idx
  on public.health_workout_programs (source_goal_id) where source_goal_id is not null;

-- ============================================================
-- 6. Program sessions (templates for each day in program)
-- ============================================================
create table public.health_workout_program_sessions (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references public.health_workout_programs(id) on delete cascade not null,
  week_number int not null default 1 check (week_number >= 1),
  day_of_week int not null check (day_of_week between 1 and 7),
  order_in_week int not null default 1 check (order_in_week >= 1),
  name text not null,
  session_type text not null default 'strength'
    check (session_type in ('strength', 'hypertrophy', 'endurance', 'hiit', 'cardio', 'mobility', 'sport', 'active_rest')),
  target_minutes int check (target_minutes is null or target_minutes > 0),
  target_rpe int check (target_rpe is null or target_rpe between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_workout_program_sessions_program_idx
  on public.health_workout_program_sessions (program_id, week_number, day_of_week);

-- Add FK from sessions to program_sessions (after table exists)
alter table public.health_workout_sessions
  add constraint health_workout_sessions_program_session_fk
    foreign key (program_session_id)
    references public.health_workout_program_sessions(id) on delete set null;
alter table public.health_workout_sessions
  add constraint health_workout_sessions_program_fk
    foreign key (program_id)
    references public.health_workout_programs(id) on delete set null;

-- ============================================================
-- 7. Program exercises (target sets/reps/weight per program-session)
-- ============================================================
create table public.health_workout_program_exercises (
  id uuid default gen_random_uuid() primary key,
  program_session_id uuid references public.health_workout_program_sessions(id) on delete cascade not null,
  exercise_id uuid references public.health_exercises(id) on delete restrict not null,
  order_index int not null default 1 check (order_index >= 1),
  target_sets int not null default 3 check (target_sets between 1 and 30),
  target_reps text not null default '8-12',
  target_weight_pct_1rm numeric(5, 2) check (target_weight_pct_1rm is null or target_weight_pct_1rm between 0 and 200),
  target_rir int check (target_rir is null or target_rir between 0 and 10),
  target_rest_seconds int check (target_rest_seconds is null or target_rest_seconds between 0 and 600),
  is_superset_with_next boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_workout_program_exercises_session_idx
  on public.health_workout_program_exercises (program_session_id, order_index);

-- ============================================================
-- 8. 1RM history (per-exercise progression)
-- ============================================================
create table public.health_workout_one_rm_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_id uuid references public.health_exercises(id) on delete cascade not null,
  estimated_1rm_kg numeric(7, 2) not null check (estimated_1rm_kg > 0),
  is_actual boolean not null default false,
  formula text not null default 'epley'
    check (formula in ('epley', 'brzycki', 'lombardi', 'tested')),
  source_set_id uuid references public.health_workout_sets(id) on delete set null,
  achieved_on date not null,
  created_at timestamptz not null default now()
);

create index health_workout_one_rm_history_user_exercise_idx
  on public.health_workout_one_rm_history (user_id, exercise_id, achieved_on desc);

-- ============================================================
-- 9. Personal records (PR detection log)
-- ============================================================
create table public.health_workout_personal_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_id uuid references public.health_exercises(id) on delete cascade,
  kind text not null
    check (kind in (
      '1rm', '3rm', '5rm', 'reps_at_weight', 'volume_session',
      'distance', 'pace', 'time_for_distance', 'duration', 'other'
    )),
  value numeric(12, 3) not null,
  unit text not null,
  achieved_on date not null,
  session_id uuid references public.health_workout_sessions(id) on delete set null,
  broken_by_id uuid references public.health_workout_personal_records(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index health_workout_personal_records_user_idx
  on public.health_workout_personal_records (user_id, achieved_on desc);
create index health_workout_personal_records_exercise_idx
  on public.health_workout_personal_records (user_id, exercise_id, kind, achieved_on desc)
  where exercise_id is not null;

-- ============================================================
-- 10. Training profile (singleton per user)
-- ============================================================
create table public.health_user_training_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_hr int check (max_hr is null or max_hr between 80 and 230),
  resting_hr int check (resting_hr is null or resting_hr between 30 and 120),
  vo2max_estimate numeric(5, 2) check (vo2max_estimate is null or vo2max_estimate between 10 and 100),
  body_weight_kg numeric(6, 2) check (body_weight_kg is null or body_weight_kg between 20 and 400),
  sport_preferences text[] not null default '{}',
  available_equipment text[] not null default '{}',
  gym_or_home text check (gym_or_home is null or gym_or_home in ('gym', 'home', 'outdoor', 'mixed')),
  total_volume_weekly_target_kg numeric(10, 2) check (total_volume_weekly_target_kg is null or total_volume_weekly_target_kg >= 0),
  weekly_intensity_minutes_target int check (weekly_intensity_minutes_target is null or weekly_intensity_minutes_target >= 0),
  cooper_test_distance_m int check (cooper_test_distance_m is null or cooper_test_distance_m >= 0),
  cooper_test_date date,
  training_age_years numeric(4, 1) check (training_age_years is null or training_age_years between 0 and 80),
  body_battery_score int check (body_battery_score is null or body_battery_score between 0 and 100),
  body_battery_components jsonb,
  body_battery_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row level security
-- ============================================================
alter table public.health_exercises enable row level security;
alter table public.health_workout_sessions enable row level security;
alter table public.health_workout_sets enable row level security;
alter table public.health_workout_supersets enable row level security;
alter table public.health_workout_programs enable row level security;
alter table public.health_workout_program_sessions enable row level security;
alter table public.health_workout_program_exercises enable row level security;
alter table public.health_workout_one_rm_history enable row level security;
alter table public.health_workout_personal_records enable row level security;
alter table public.health_user_training_profile enable row level security;

-- Exercises: system rows (user_id is null) readable by everyone; custom rows owned by user
create policy "exercises_read_system_or_own" on public.health_exercises
  for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_write_own" on public.health_exercises
  for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.health_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.health_exercises
  for delete using (auth.uid() = user_id);

-- Sessions / sets / supersets: full ownership
create policy "users_own_workout_sessions" on public.health_workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_workout_sets" on public.health_workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_workout_supersets" on public.health_workout_supersets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Programs: system (user_id is null + is_published) readable; user_id owned
create policy "programs_read_system_or_own" on public.health_workout_programs
  for select using (
    (user_id is null and is_published is true)
    or auth.uid() = user_id
  );
create policy "programs_write_own" on public.health_workout_programs
  for insert with check (auth.uid() = user_id);
create policy "programs_update_own" on public.health_workout_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "programs_delete_own" on public.health_workout_programs
  for delete using (auth.uid() = user_id);

-- Program sessions / exercises: visible if parent program is visible
create policy "program_sessions_read" on public.health_workout_program_sessions
  for select using (
    exists (
      select 1 from public.health_workout_programs p
      where p.id = health_workout_program_sessions.program_id
        and ((p.user_id is null and p.is_published is true) or p.user_id = auth.uid())
    )
  );
create policy "program_sessions_write_own_program" on public.health_workout_program_sessions
  for all using (
    exists (
      select 1 from public.health_workout_programs p
      where p.id = health_workout_program_sessions.program_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.health_workout_programs p
      where p.id = health_workout_program_sessions.program_id and p.user_id = auth.uid()
    )
  );

create policy "program_exercises_read" on public.health_workout_program_exercises
  for select using (
    exists (
      select 1 from public.health_workout_program_sessions ps
      join public.health_workout_programs p on p.id = ps.program_id
      where ps.id = health_workout_program_exercises.program_session_id
        and ((p.user_id is null and p.is_published is true) or p.user_id = auth.uid())
    )
  );
create policy "program_exercises_write_own_program" on public.health_workout_program_exercises
  for all using (
    exists (
      select 1 from public.health_workout_program_sessions ps
      join public.health_workout_programs p on p.id = ps.program_id
      where ps.id = health_workout_program_exercises.program_session_id
        and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.health_workout_program_sessions ps
      join public.health_workout_programs p on p.id = ps.program_id
      where ps.id = health_workout_program_exercises.program_session_id
        and p.user_id = auth.uid()
    )
  );

-- 1RM history / personal records / training profile: full ownership
create policy "users_own_one_rm_history" on public.health_workout_one_rm_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_personal_records" on public.health_workout_personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_own_training_profile" on public.health_user_training_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create trigger set_health_exercises_updated_at
  before update on public.health_exercises
  for each row execute function public.set_updated_at();
create trigger set_health_workout_sessions_updated_at
  before update on public.health_workout_sessions
  for each row execute function public.set_updated_at();
create trigger set_health_workout_sets_updated_at
  before update on public.health_workout_sets
  for each row execute function public.set_updated_at();
create trigger set_health_workout_supersets_updated_at
  before update on public.health_workout_supersets
  for each row execute function public.set_updated_at();
create trigger set_health_workout_programs_updated_at
  before update on public.health_workout_programs
  for each row execute function public.set_updated_at();
create trigger set_health_workout_program_sessions_updated_at
  before update on public.health_workout_program_sessions
  for each row execute function public.set_updated_at();
create trigger set_health_workout_program_exercises_updated_at
  before update on public.health_workout_program_exercises
  for each row execute function public.set_updated_at();
create trigger set_health_user_training_profile_updated_at
  before update on public.health_user_training_profile
  for each row execute function public.set_updated_at();

-- ============================================================
-- Legacy mirror trigger
-- ----------------------------------------------------------------
-- When a new session is marked completed, upsert a thin row into
-- legacy `health_workouts` so existing /health/dashboard and the
-- old Telegram mini-app keep showing recent activity unchanged.
-- ============================================================
create or replace function public.health_workouts_legacy_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_muscle_groups text[];
begin
  if new.is_completed is not true then
    return new;
  end if;

  -- Map new session_type → legacy kind enum (strength|cardio|yoga|stretching|walk|sport|other)
  v_kind := case
    when new.session_type in ('strength', 'hypertrophy') then 'strength'
    when new.session_type in ('cardio', 'endurance', 'hiit') then 'cardio'
    when new.session_type = 'mobility' then 'stretching'
    when new.session_type = 'sport' then
      case
        when new.sport_kind = 'yoga' then 'yoga'
        when new.sport_kind in ('walking', 'hiking') then 'walk'
        else 'sport'
      end
    else 'other'
  end;

  -- Derive muscle_groups from logged sets via exercise.primary_muscle
  select coalesce(array_agg(distinct e.primary_muscle), '{}')
  into v_muscle_groups
  from public.health_workout_sets s
  join public.health_exercises e on e.id = s.exercise_id
  where s.session_id = new.id;

  insert into public.health_workouts (
    id, user_id, occurred_on, kind, title, duration_minutes, intensity,
    calories, muscle_groups, notes, created_at, updated_at
  )
  values (
    new.id, new.user_id, new.occurred_on, v_kind, new.title,
    new.duration_minutes, new.rpe, new.calories, v_muscle_groups, new.notes,
    new.created_at, new.updated_at
  )
  on conflict (id) do update set
    occurred_on = excluded.occurred_on,
    kind = excluded.kind,
    title = excluded.title,
    duration_minutes = excluded.duration_minutes,
    intensity = excluded.intensity,
    calories = excluded.calories,
    muscle_groups = excluded.muscle_groups,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger health_workout_sessions_legacy_mirror
  after insert or update on public.health_workout_sessions
  for each row execute function public.health_workouts_legacy_mirror();
