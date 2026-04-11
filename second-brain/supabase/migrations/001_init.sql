create extension if not exists vector;

-- User profiles (extends Supabase auth.users)
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  language text default 'ru',
  role text check (role in ('mom','freelancer','student','entrepreneur','other')),
  living_with text check (living_with in ('alone','couple','with_kids')),
  peak_hours text check (peak_hours in ('morning','afternoon','evening')),
  created_at timestamptz default now()
);
alter table public.user_profiles enable row level security;
create policy "users_own_profile" on public.user_profiles
  for all using (auth.uid() = id);

-- Raw audio/text dumps
create table public.dumps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  raw_text text,
  audio_url text,
  status text default 'done' check (status in ('processing','done','failed')),
  created_at timestamptz default now()
);
alter table public.dumps enable row level security;
create policy "users_own_dumps" on public.dumps
  for all using (auth.uid() = user_id);
create index dumps_user_created_idx on public.dumps (user_id, created_at desc);

-- Tasks
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  dump_id uuid references public.dumps(id) on delete set null,
  title text not null,
  notes text,
  sphere text check (sphere in ('work','family','study','health','travel')),
  priority int default 2 check (priority in (1,2,3)),
  deadline timestamptz,
  reminder_at timestamptz,
  is_done boolean default false,
  is_today boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "users_own_tasks" on public.tasks
  for all using (auth.uid() = user_id);

create index tasks_today_idx on public.tasks (user_id, is_today, is_done) where is_done = false;
create index tasks_sphere_idx on public.tasks (user_id, sphere, is_done) where is_done = false;
create index tasks_priority_idx on public.tasks (user_id, priority desc, created_at desc);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
