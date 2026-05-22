-- Migration 022: full nutrition tracking contracts

alter table public.health_foods
  add column if not exists saturated_fat_per_100g numeric(10,2) check (saturated_fat_per_100g is null or saturated_fat_per_100g >= 0),
  add column if not exists micronutrients jsonb not null default '{}'::jsonb,
  add column if not exists source_ref text,
  add column if not exists is_confirmed boolean not null default true,
  add column if not exists food_score text check (food_score is null or food_score in ('green', 'yellow', 'red')),
  add column if not exists image_text text;

alter table public.health_nutrition_targets
  add column if not exists sex text,
  add column if not exists age int check (age is null or age between 13 and 120),
  add column if not exists height_cm numeric(10,2) check (height_cm is null or height_cm between 90 and 250),
  add column if not exists weight_kg numeric(10,2) check (weight_kg is null or weight_kg between 25 and 400),
  add column if not exists goal_weight_kg numeric(10,2) check (goal_weight_kg is null or goal_weight_kg between 25 and 400),
  add column if not exists activity_level text not null default 'moderate'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add column if not exists goal_type text not null default 'maintain'
    check (goal_type in ('lose', 'maintain', 'gain')),
  add column if not exists diet_mode text not null default 'balanced'
    check (diet_mode in ('balanced', 'high_protein', 'keto', 'mediterranean', 'vegan')),
  add column if not exists bmr int check (bmr is null or bmr >= 0),
  add column if not exists tdee int check (tdee is null or tdee >= 0);

create table if not exists public.health_weight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_on date not null,
  weight_kg numeric(10,2) not null check (weight_kg > 0),
  body_fat_pct numeric(5,2) check (body_fat_pct is null or body_fat_pct between 1 and 80),
  muscle_mass_kg numeric(10,2) check (muscle_mass_kg is null or muscle_mass_kg > 0),
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  servings numeric(10,2) not null default 1 check (servings > 0),
  items jsonb not null default '[]'::jsonb,
  calories_per_serving numeric(10,2) check (calories_per_serving is null or calories_per_serving >= 0),
  protein_g_per_serving numeric(10,2) check (protein_g_per_serving is null or protein_g_per_serving >= 0),
  carbs_g_per_serving numeric(10,2) check (carbs_g_per_serving is null or carbs_g_per_serving >= 0),
  fat_g_per_serving numeric(10,2) check (fat_g_per_serving is null or fat_g_per_serving >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_nutrition_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null,
  unlocked_on date not null default current_date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.health_weight_logs enable row level security;
alter table public.health_recipes enable row level security;
alter table public.health_nutrition_achievements enable row level security;

drop policy if exists "users_own_health_weight_logs" on public.health_weight_logs;
create policy "users_own_health_weight_logs" on public.health_weight_logs
  for all using (auth.uid() = user_id);

drop policy if exists "users_own_health_recipes" on public.health_recipes;
create policy "users_own_health_recipes" on public.health_recipes
  for all using (auth.uid() = user_id);

drop policy if exists "users_own_health_nutrition_achievements" on public.health_nutrition_achievements;
create policy "users_own_health_nutrition_achievements" on public.health_nutrition_achievements
  for all using (auth.uid() = user_id);

create index if not exists health_foods_user_barcode_idx on public.health_foods (user_id, barcode);
create index if not exists health_foods_user_confirmed_idx on public.health_foods (user_id, is_confirmed);
create index if not exists health_weight_logs_user_day_idx on public.health_weight_logs (user_id, logged_on desc);
create index if not exists health_recipes_user_title_idx on public.health_recipes (user_id, title);

drop trigger if exists set_health_weight_logs_updated_at on public.health_weight_logs;
create trigger set_health_weight_logs_updated_at
  before update on public.health_weight_logs
  for each row execute function public.set_updated_at();

drop trigger if exists set_health_recipes_updated_at on public.health_recipes;
create trigger set_health_recipes_updated_at
  before update on public.health_recipes
  for each row execute function public.set_updated_at();
