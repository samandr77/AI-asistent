-- 024_tasks_stage03_calendar_habits.sql
-- Stage 03 completion: internal task calendar reminders and habit completion history.

begin;

alter table public.tasks add column if not exists last_reminded_at timestamptz;
create index if not exists tasks_due_reminders_idx
  on public.tasks (user_id, reminder_at)
  where reminder_at is not null and is_done = false;

create table if not exists public.task_habit_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  event_date date not null,
  completed boolean not null default true,
  completed_at timestamptz,
  note text,
  created_at timestamptz default now() not null,
  unique (user_id, task_id, event_date)
);

alter table public.task_habit_events enable row level security;
drop policy if exists "users_own_task_habit_events" on public.task_habit_events;
create policy "users_own_task_habit_events" on public.task_habit_events
  for all using (auth.uid() = user_id);

create index if not exists task_habit_events_task_date_idx
  on public.task_habit_events (user_id, task_id, event_date desc);

commit;
