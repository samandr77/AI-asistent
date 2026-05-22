-- Migration 020: Health v2 sleep scoring, food diary, and AI insight cache

alter table public.health_sleep_logs
  add column if not exists time_in_bed_minutes int check (time_in_bed_minutes is null or (time_in_bed_minutes > 0 and time_in_bed_minutes <= 1440)),
  add column if not exists sleep_latency_minutes int check (sleep_latency_minutes is null or sleep_latency_minutes >= 0),
  add column if not exists awakenings_count int check (awakenings_count is null or awakenings_count >= 0),
  add column if not exists awake_minutes int check (awake_minutes is null or awake_minutes >= 0),
  add column if not exists restoration int check (restoration is null or restoration between 1 and 10),
  add column if not exists quality_score int check (quality_score is null or quality_score between 0 and 100),
  add column if not exists quality_breakdown jsonb not null default '{}'::jsonb;

create table if not exists public.health_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand text,
  barcode text,
  serving_name text not null default '100 g',
  serving_grams numeric(10,2) not null default 100 check (serving_grams > 0),
  calories_per_100g numeric(10,2) check (calories_per_100g is null or calories_per_100g >= 0),
  protein_per_100g numeric(10,2) check (protein_per_100g is null or protein_per_100g >= 0),
  carbs_per_100g numeric(10,2) check (carbs_per_100g is null or carbs_per_100g >= 0),
  fat_per_100g numeric(10,2) check (fat_per_100g is null or fat_per_100g >= 0),
  fiber_per_100g numeric(10,2) check (fiber_per_100g is null or fiber_per_100g >= 0),
  sugar_per_100g numeric(10,2) check (sugar_per_100g is null or sugar_per_100g >= 0),
  sodium_mg_per_100g numeric(10,2) check (sodium_mg_per_100g is null or sodium_mg_per_100g >= 0),
  source text not null default 'manual',
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, brand)
);

create table if not exists public.health_meal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_on date not null,
  meal_type text not null default 'snack'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text,
  source text not null default 'manual',
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_meal_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_id uuid references public.health_meal_entries(id) on delete cascade not null,
  food_id uuid references public.health_foods(id) on delete set null,
  name text not null,
  serving_qty numeric(10,2) not null default 1 check (serving_qty > 0),
  serving_name text not null default 'порция',
  grams numeric(10,2) check (grams is null or grams > 0),
  calories numeric(10,2) check (calories is null or calories >= 0),
  protein_g numeric(10,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10,2) check (fat_g is null or fat_g >= 0),
  fiber_g numeric(10,2) check (fiber_g is null or fiber_g >= 0),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_water_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_on date not null,
  amount_ml int not null check (amount_ml > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.health_nutrition_targets (
  user_id uuid references auth.users(id) on delete cascade primary key,
  calories int check (calories is null or calories > 0),
  protein_g numeric(10,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10,2) check (fat_g is null or fat_g >= 0),
  water_ml int check (water_ml is null or water_ml > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_ai_insight_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  period_days int not null,
  input_hash text not null,
  insights_json jsonb not null default '[]'::jsonb,
  tokens int not null default 0,
  tier text not null default 'fallback',
  generated_at timestamptz not null default now(),
  unique (user_id, period_days, input_hash)
);

alter table public.health_foods enable row level security;
alter table public.health_meal_entries enable row level security;
alter table public.health_meal_items enable row level security;
alter table public.health_water_logs enable row level security;
alter table public.health_nutrition_targets enable row level security;
alter table public.health_ai_insight_cache enable row level security;

drop policy if exists "users_own_health_foods" on public.health_foods;
create policy "users_own_health_foods" on public.health_foods
  for all using (auth.uid() = user_id);
drop policy if exists "users_own_health_meal_entries" on public.health_meal_entries;
create policy "users_own_health_meal_entries" on public.health_meal_entries
  for all using (auth.uid() = user_id);
drop policy if exists "users_own_health_meal_items" on public.health_meal_items;
create policy "users_own_health_meal_items" on public.health_meal_items
  for all using (auth.uid() = user_id);
drop policy if exists "users_own_health_water_logs" on public.health_water_logs;
create policy "users_own_health_water_logs" on public.health_water_logs
  for all using (auth.uid() = user_id);
drop policy if exists "users_own_health_nutrition_targets" on public.health_nutrition_targets;
create policy "users_own_health_nutrition_targets" on public.health_nutrition_targets
  for all using (auth.uid() = user_id);
drop policy if exists "users_own_health_ai_insight_cache" on public.health_ai_insight_cache;
create policy "users_own_health_ai_insight_cache" on public.health_ai_insight_cache
  for all using (auth.uid() = user_id);

create index if not exists health_foods_user_name_idx on public.health_foods (user_id, name);
create index if not exists health_meal_entries_user_day_idx on public.health_meal_entries (user_id, logged_on desc);
create index if not exists health_meal_items_user_meal_idx on public.health_meal_items (user_id, meal_id);
create index if not exists health_water_logs_user_day_idx on public.health_water_logs (user_id, logged_on desc);
create index if not exists health_ai_insight_cache_user_idx on public.health_ai_insight_cache (user_id, period_days, generated_at desc);

drop trigger if exists set_health_foods_updated_at on public.health_foods;
create trigger set_health_foods_updated_at
  before update on public.health_foods
  for each row execute function public.set_updated_at();
drop trigger if exists set_health_meal_entries_updated_at on public.health_meal_entries;
create trigger set_health_meal_entries_updated_at
  before update on public.health_meal_entries
  for each row execute function public.set_updated_at();
drop trigger if exists set_health_meal_items_updated_at on public.health_meal_items;
create trigger set_health_meal_items_updated_at
  before update on public.health_meal_items
  for each row execute function public.set_updated_at();
drop trigger if exists set_health_nutrition_targets_updated_at on public.health_nutrition_targets;
create trigger set_health_nutrition_targets_updated_at
  before update on public.health_nutrition_targets
  for each row execute function public.set_updated_at();
