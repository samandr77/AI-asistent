-- Migration 019: Health and energy module

create table public.health_daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  mood int check (mood is null or mood between 1 and 10),
  energy int check (energy is null or energy between 1 and 10),
  stress int check (stress is null or stress between 1 and 10),
  readiness_override int check (readiness_override is null or readiness_override between 1 and 10),
  symptoms text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.health_sleep_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  sleep_date date not null,
  bedtime text,
  wake_time text,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 1440),
  quality int check (quality is null or quality between 1 and 10),
  phases jsonb not null default '{}'::jsonb,
  factors text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_date date not null,
  steps int not null default 0 check (steps >= 0),
  distance_meters int check (distance_meters is null or distance_meters >= 0),
  active_minutes int not null default 0 check (active_minutes >= 0),
  calories int check (calories is null or calories >= 0),
  stand_hours int check (stand_hours is null or stand_hours >= 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date, source)
);

create table public.health_workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  occurred_on date not null,
  kind text not null default 'other'
    check (kind in ('strength', 'cardio', 'yoga', 'stretching', 'walk', 'sport', 'other')),
  title text not null,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  intensity int check (intensity is null or intensity between 1 and 10),
  calories int check (calories is null or calories >= 0),
  muscle_groups text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_nutrition_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_on date not null,
  calories int check (calories is null or calories >= 0),
  protein_g numeric(8,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(8,2) check (fat_g is null or fat_g >= 0),
  water_ml int check (water_ml is null or water_ml >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.health_biomarkers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  measured_on date not null,
  kind text not null
    check (kind in (
      'hrv', 'resting_heart_rate', 'heart_rate', 'spo2', 'breathing_rate',
      'blood_pressure_systolic', 'blood_pressure_diastolic', 'glucose',
      'cholesterol', 'weight', 'body_fat', 'temperature', 'other'
    )),
  value numeric(12,3) not null,
  unit text not null,
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_medical_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  record_date date not null,
  kind text not null default 'note'
    check (kind in ('lab', 'medication', 'visit', 'vaccine', 'document', 'note')),
  title text not null,
  provider text,
  summary text,
  file_url text,
  is_sensitive boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_daily_logs enable row level security;
alter table public.health_sleep_logs enable row level security;
alter table public.health_activity_logs enable row level security;
alter table public.health_workouts enable row level security;
alter table public.health_nutrition_logs enable row level security;
alter table public.health_biomarkers enable row level security;
alter table public.health_medical_records enable row level security;

create policy "users_own_health_daily_logs" on public.health_daily_logs
  for all using (auth.uid() = user_id);
create policy "users_own_health_sleep_logs" on public.health_sleep_logs
  for all using (auth.uid() = user_id);
create policy "users_own_health_activity_logs" on public.health_activity_logs
  for all using (auth.uid() = user_id);
create policy "users_own_health_workouts" on public.health_workouts
  for all using (auth.uid() = user_id);
create policy "users_own_health_nutrition_logs" on public.health_nutrition_logs
  for all using (auth.uid() = user_id);
create policy "users_own_health_biomarkers" on public.health_biomarkers
  for all using (auth.uid() = user_id);
create policy "users_own_health_medical_records" on public.health_medical_records
  for all using (auth.uid() = user_id);

create index health_daily_logs_user_date_idx on public.health_daily_logs (user_id, log_date desc);
create index health_sleep_logs_user_date_idx on public.health_sleep_logs (user_id, sleep_date desc);
create index health_activity_logs_user_date_idx on public.health_activity_logs (user_id, activity_date desc);
create index health_workouts_user_date_idx on public.health_workouts (user_id, occurred_on desc);
create index health_nutrition_logs_user_date_idx on public.health_nutrition_logs (user_id, logged_on desc);
create index health_biomarkers_user_kind_date_idx on public.health_biomarkers (user_id, kind, measured_on desc);
create index health_medical_records_user_date_idx on public.health_medical_records (user_id, record_date desc);

create trigger set_health_daily_logs_updated_at
  before update on public.health_daily_logs
  for each row execute function public.set_updated_at();
create trigger set_health_sleep_logs_updated_at
  before update on public.health_sleep_logs
  for each row execute function public.set_updated_at();
create trigger set_health_activity_logs_updated_at
  before update on public.health_activity_logs
  for each row execute function public.set_updated_at();
create trigger set_health_workouts_updated_at
  before update on public.health_workouts
  for each row execute function public.set_updated_at();
create trigger set_health_nutrition_logs_updated_at
  before update on public.health_nutrition_logs
  for each row execute function public.set_updated_at();
create trigger set_health_biomarkers_updated_at
  before update on public.health_biomarkers
  for each row execute function public.set_updated_at();
create trigger set_health_medical_records_updated_at
  before update on public.health_medical_records
  for each row execute function public.set_updated_at();
