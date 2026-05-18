# Stage 5 - Reflections And Reminder Settings

## Objective

Port daily reflection and streak workflows, replacing local Expo notification preferences with backend-backed Telegram reminder settings.

## Screens

- Reflection history: `/reflection`
- Today reflection: `/reflection/today`
- Reflection detail: `/reflection/:date`
- Reflection settings: `/reflection/settings`

## Work To Do

- Port reflection history list.
- Port streak display.
- Port backfill-yesterday banner.
- Port today reflection form:
  - daily summary.
  - mood 1-5.
  - energy 1-5.
  - notes max 4000 chars.
- Port reflection detail.
- Port delete reflection.
- Build reminder settings screen:
  - daily reflection enabled.
  - daily reflection time.
  - morning planning optional.
  - timezone.
  - test reminder action.
- Add backend reminder settings table and API.
- Add reminder selection service for cron.
- Defer actual bot sending to Stage 6 if bot runtime is not ready.

## Backend API Reuse

- `GET /reflections/today/summary`
- `GET /reflections/stats`
- `GET /reflections/`
- `GET /reflections/{ref_date}`
- `POST /reflections/`
- `PATCH /reflections/{reflection_id}`
- `DELETE /reflections/{reflection_id}`

## New Backend API

- `GET /telegram/reminders/settings`
- `PUT /telegram/reminders/settings`
- `POST /telegram/reminders/test`
- `POST /admin/send-telegram-reminders` or extend existing cron/admin surface.

## Migration

```sql
create table public.telegram_reminder_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  telegram_user_id bigint not null,
  daily_reflection_enabled boolean default true,
  daily_reflection_time text default '21:00',
  morning_enabled boolean default false,
  morning_time text default '09:00',
  timezone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/reflection/ReflectionListScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/reflection/TodayReflectionScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/reflection/ReflectionDetailScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/reflection/ReflectionSettingsScreen.tsx`
- `second-brain/telegram-miniapp/src/components/MoodEnergyPicker.tsx`

## Tests

- Reflection list loads and displays streak.
- Today summary displays completed tasks and goal-aligned tasks.
- Mood and energy are required.
- Notes max length is enforced.
- Create reflection saves and updates cache.
- Existing today's reflection updates instead of duplicate create.
- Reminder settings save to backend.
- Reminder job selects users due at current local time.

## Acceptance Criteria

- User can complete an evening reflection inside Telegram.
- Reflection history and detail are usable.
- Reminder preferences are stored server-side.
- Reminder delivery can be performed by bot runtime in Stage 6.
