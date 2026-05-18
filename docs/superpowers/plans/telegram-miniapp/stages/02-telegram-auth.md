# Stage 2 - Telegram Auth

## Objective

Allow a Telegram user to open the Mini App and receive a backend session without email/password, Apple OAuth, or Google OAuth.

## Work To Do

- Add backend Telegram environment variables.
- Implement Telegram `initData` validation.
- Add `telegram_accounts` table.
- Bootstrap internal Supabase auth users for Telegram accounts.
- Issue app session JWTs for the existing FastAPI API.
- Extend existing auth dependency to accept both Supabase JWT and app session JWT.
- Add `/telegram/auth/session`.
- Build Launch screen.
- Build session store in the Mini App.
- Route new users to onboarding and onboarded users to Today.
- Route soft-deleted users to account-pending-deletion screen.

## Backend Environment Variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_SESSION_JWT_SECRET`
- `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_MINIAPP_URL`

## Backend Files

- `second-brain/backend/config.py`
- `second-brain/backend/auth.py`
- `second-brain/backend/main.py`
- `second-brain/backend/api/telegram_auth.py`
- `second-brain/backend/services/telegram_init_data.py`
- `second-brain/backend/services/telegram_users.py`
- `second-brain/backend/models/telegram.py`
- `second-brain/backend/tests/test_telegram_auth.py`

## Migration

```sql
create table public.telegram_accounts (
  telegram_user_id bigint primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  photo_url text,
  allows_write_to_pm boolean default false,
  last_auth_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## API Contract

`POST /telegram/auth/session`

Input:

```json
{
  "init_data": "query_id=...&user=...&auth_date=...&hash=..."
}
```

Output:

```json
{
  "access_token": "...",
  "expires_at": "2026-05-09T00:00:00Z",
  "user": {
    "id": "internal-uuid",
    "telegram_user_id": 123456789,
    "provider": "telegram"
  },
  "profile": {},
  "is_new_user": true,
  "start_param": "reflection_today"
}
```

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/launch/LaunchScreen.tsx`
- `second-brain/telegram-miniapp/src/telegram/auth.ts`
- `second-brain/telegram-miniapp/src/store/useSessionStore.ts`
- `second-brain/telegram-miniapp/src/services/api.ts`

## Tests

- Valid `initData` creates a session.
- Tampered `initData` is rejected.
- Stale `auth_date` is rejected.
- Missing user in `initData` is rejected.
- Existing Telegram account maps to same internal UUID.
- Soft-deleted profile returns pending deletion state.
- Existing `/dump`, `/tasks`, `/goals`, `/reflections` endpoints accept app session JWT.

## Acceptance Criteria

- User can open Mini App from Telegram and enter app without email/password.
- User identity is always validated server-side.
- The existing native app auth flow remains unchanged.
- No backend endpoint trusts `initDataUnsafe`.
