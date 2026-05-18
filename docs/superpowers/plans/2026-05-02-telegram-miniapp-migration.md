# Second Brain - Telegram Mini App Migration Plan

**Created:** 2026-05-02  
**Goal:** Port the existing Second Brain mobile experience into a Telegram Mini App without losing core product capabilities: voice/text capture, AI task parsing, goals, daily reflection, premium gating, reminders, account deletion, i18n, and production observability.

**Recommended direction:** Build a new Telegram Mini App web client as a second frontend, keep the existing FastAPI + Supabase backend as the system of record, and add Telegram-specific auth, bot, payment, and notification surfaces. Do not try to ship the Expo app directly as the Mini App; the current native modules (RevenueCat, expo-notifications, native OAuth, MMKV, expo-audio) create avoidable friction in Telegram's WebView.

**Current product baseline:** derived from the existing Expo screens in `second-brain/mobile/app`, backend routes in `second-brain/backend/api`, and production-readiness plan `.specify/specs/005-production-readiness/plan.md`.

**Telegram platform references:**
- Telegram Mini Apps docs: https://core.telegram.org/bots/webapps
- Telegram Stars payments for digital goods: https://core.telegram.org/bots/payments-stars
- Telegram Bot API payments/subscriptions: https://core.telegram.org/bots/api#createinvoicelink

**Split working docs:**
- Roadmap: [telegram-miniapp/roadmap.md](telegram-miniapp/roadmap.md)
- Implementation tasks: [telegram-miniapp/tasks.md](telegram-miniapp/tasks.md)

---

## 1. Product Scope

### Must Preserve

- Text dump -> AI parsing -> structured tasks.
- Voice dump -> transcription -> AI parsing -> structured tasks.
- Today top tasks.
- All tasks with sphere filtering and free-history cutoff.
- Task detail: edit title, complete, delete, show sphere, notes, deadline, reminder.
- Goals: create, list by status, view detail, edit title/status, delete, computed progress, linked tasks.
- Goal-aware AI parsing and auto-linking.
- Daily reflection: day summary, mood, energy, notes, edit today's reflection, history, streaks.
- Reflection reminder settings.
- Profile: user info, stats, AI memory preview, premium status, sign out/end session, account deletion.
- Premium gating: free vs premium limits for dumps, goals, AI tier policy, history.
- RU/EN localization.
- Sentry/error visibility and backend tests.

### Telegram-Specific Additions

- One-tap Telegram identity via Mini App `initData`.
- Main bot entrypoint with `/start` and persistent menu button.
- Bot-side text and voice dumps as an alternative to in-app recording.
- Telegram Stars subscription purchase inside Telegram.
- Telegram bot reminders for daily reflection and task reminders.
- Deep links into Mini App screens from bot messages.
- Telegram theme integration, back button, haptics, viewport handling.
- Optional home-screen shortcut prompt when supported.

### Out of Scope for First Telegram Release

- Apple/Google OAuth inside the Mini App.
- RevenueCat inside Telegram. Existing RevenueCat remains for iOS/Android apps only.
- App Store / Play Console submission work for the Telegram client.
- Group/shared workspace features, even though Telegram supports chat-context Mini Apps.
- Inline mode publishing of tasks into chats. This can be a later sharing feature.

---

## 2. Target Architecture

```text
Telegram user
  |
  | opens @SecondBrainBot Mini App
  v
Telegram Mini App web client
  - React + TypeScript
  - Telegram WebApp SDK wrapper
  - Zustand or TanStack Query client cache
  - IndexedDB/Telegram DeviceStorage fallback for pending dumps
  |
  | Bearer <Second Brain app session JWT>
  v
FastAPI backend
  - existing /dump, /tasks, /goals, /reflections, /memory, /premium, /auth
  - new /telegram/auth, /telegram/payments, /telegram/webhook
  |
  v
Supabase Postgres
  - existing user-owned tables
  - new telegram identity/payment/reminder tables
```

### Frontend Package

Create:

```text
second-brain/telegram-miniapp/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── providers.tsx
│   ├── telegram/
│   │   ├── sdk.ts
│   │   ├── theme.ts
│   │   ├── auth.ts
│   │   └── navigation.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── dumpQueue.ts
│   │   ├── recorder.ts
│   │   └── sentry.ts
│   ├── store/
│   │   └── useAppStore.ts
│   ├── screens/
│   │   ├── launch/
│   │   ├── onboarding/
│   │   ├── today/
│   │   ├── dump/
│   │   ├── tasks/
│   │   ├── goals/
│   │   ├── reflection/
│   │   ├── premium/
│   │   └── profile/
│   ├── components/
│   ├── locales/
│   │   ├── ru.json
│   │   └── en.json
│   └── types/
│       └── api.ts
└── tests/
```

Recommended stack:
- Vite + React + TypeScript strict.
- React Router or TanStack Router for web routes.
- TanStack Query for server state, Zustand for UI/session state.
- `@telegram-apps/sdk-react` or a thin internal wrapper over `window.Telegram.WebApp`; keep app code insulated from SDK churn.
- CSS modules or plain CSS variables using Telegram theme tokens.

### Backend Package Changes

Modify:

```text
second-brain/backend/
├── auth.py                         # accept Supabase JWT and app session JWT
├── config.py                       # Telegram env vars
├── main.py                         # include telegram router
├── api/
│   ├── telegram_auth.py            # Mini App auth/session bootstrap
│   ├── telegram_payments.py        # invoice creation/status
│   ├── telegram_webhook.py         # bot updates, payments, voice/text messages
│   └── telegram_notifications.py   # reminder prefs if separated
├── services/
│   ├── telegram_init_data.py       # validate initData
│   ├── telegram_bot.py             # Bot API client
│   ├── telegram_users.py           # user mapping/bootstrap
│   ├── telegram_payments.py        # Stars subscription processing
│   └── reminder_scheduler.py       # bot reminders
└── tests/
    ├── test_telegram_auth.py
    ├── test_telegram_webhook.py
    ├── test_telegram_payments.py
    └── test_telegram_reminders.py
```

Add migrations:

```text
second-brain/supabase/migrations/
├── 010_telegram_accounts.sql
├── 011_telegram_payments.sql
└── 012_telegram_reminders.sql
```

---

## 3. Identity And Auth

### Current State

- Mobile authenticates through Supabase email/password, Apple, or Google.
- API expects a Supabase JWT signed with `SUPABASE_JWT_SECRET`.
- `user_profiles.id`, `tasks.user_id`, `goals.user_id`, etc. reference `auth.users(id)`.

### Telegram Target

Use Telegram Mini App `initData` only as a short-lived bootstrap credential. The backend validates it, maps Telegram user ID to an internal Supabase auth user, then returns a Second Brain app session JWT.

### Auth Flow

1. User opens Mini App from bot profile, direct link, or bot menu.
2. Web client reads raw `Telegram.WebApp.initData`.
3. Client sends it to `POST /telegram/auth/session`.
4. Backend validates `initData` using bot token rules and rejects stale `auth_date`.
5. Backend finds or creates `telegram_accounts` row.
6. For new Telegram users, backend creates a Supabase auth user via admin API so existing FK constraints remain valid.
7. Backend upserts `user_profiles` with Telegram display name, language, and provider metadata.
8. Backend issues app session JWT:
   - `sub`: internal Supabase user UUID.
   - `provider`: `telegram`.
   - `telegram_user_id`: Telegram integer ID.
   - short expiration, e.g. 7 days.
9. Web client uses this JWT for existing API calls.
10. `auth.py` accepts either Supabase JWT or app session JWT.

### New Tables

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

### Session Rules

- Never trust `initDataUnsafe` for backend identity.
- Reject expired bootstrap data.
- Store only needed Telegram profile fields.
- Continue account deletion semantics: deleting account soft-deletes `user_profiles`, and cleanup also deletes `telegram_accounts`, Telegram reminders, and Telegram payment rows where legally allowed.

---

## 4. Payments And Premium

### Current State

- RevenueCat purchases in mobile app.
- RevenueCat webhook writes canonical `user_premium`.
- Free user limits:
  - daily dump limit.
  - active goal limit.
  - 30-day history cutoff.
  - cheaper AI tier policy.

### Telegram Target

Inside Telegram, digital premium features must be sold through Telegram Stars. RevenueCat remains active for native mobile apps, but Mini App paywall uses Stars only.

### Payment Flow

1. User opens `Premium` screen.
2. Client calls `POST /telegram/payments/invoice`.
3. Backend creates Bot API invoice link with:
   - currency `XTR`.
   - one price item.
   - `subscription_period = 2592000` for monthly subscription.
   - payload containing internal user ID and plan ID.
4. Client calls Telegram `openInvoice(invoiceLink)`.
5. Telegram sends webhook update:
   - `pre_checkout_query`: backend validates payload and answers within 10 seconds.
   - `successful_payment`: backend records transaction and upserts `user_premium`.
6. Client polls or refreshes `GET /premium/status`.
7. Paywall closes and premium features unlock.

### New Tables

```sql
create table public.telegram_star_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  telegram_user_id bigint not null,
  plan_id text not null,
  invoice_payload text not null unique,
  telegram_payment_charge_id text unique,
  total_amount int,
  currency text check (currency = 'XTR'),
  subscription_expiration_date timestamptz,
  is_recurring boolean default false,
  is_first_recurring boolean default false,
  status text not null default 'pending'
    check (status in ('pending','paid','refunded','failed','cancelled')),
  raw_update jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Premium Policy

- `user_premium` remains canonical.
- Add source metadata if needed: `source = revenuecat | telegram_stars`.
- Telegram refunds call Bot API `refundStarPayment` and mark `user_premium.is_premium = false` if no other active entitlement exists.
- Bot must support `/paysupport`.

---

## 5. Notifications And Reminders

### Current State

- Mobile uses `expo-notifications`.
- Reflection reminder time is stored in local Zustand/MMKV.
- Task reminders are local notifications based on `reminder_at`.

### Telegram Target

Telegram Mini App cannot rely on Expo local notifications. Use bot messages.

### Reminder Types

- Daily evening reflection reminder.
- Morning planning reminder.
- Task reminder for tasks with `reminder_at`.
- Premium/payment status notifications.
- Account deletion confirmation and purge date.

### New Table

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

### Bot Message Deep Links

- Reflection reminder: `https://t.me/<bot>?startapp=reflection_today`
- Task reminder: `https://t.me/<bot>?startapp=task_<task_id>`
- Paywall: `https://t.me/<bot>?startapp=premium`
- Continue onboarding: `https://t.me/<bot>?startapp=onboarding`

---

## 6. Screen Plan

### 6.1 Launch / Session Bootstrap

**Route:** `/`  
**Purpose:** Authenticate through Telegram and route to correct first screen.

**States:**
- Loading Telegram SDK.
- Unsupported browser/not opened in Telegram.
- Init data missing.
- Auth failed or expired.
- New user -> onboarding.
- Existing onboarded user -> Today.
- Pending account deletion -> account status screen.

**Functions:**
- Call `Telegram.WebApp.ready()`.
- Apply Telegram theme CSS variables.
- Expand/fullscreen where supported.
- Read start parameter and route deep links.
- Exchange `initData` for app session token.

### 6.2 Onboarding: Profile Setup

**Route:** `/onboarding/setup`  
**Based on:** `mobile/app/(onboarding)/setup.tsx`

**Fields:**
- Name, prefilled from Telegram first/last name.
- Role: mom, freelancer, student, entrepreneur, other.
- Peak hours: morning, afternoon, evening.
- Language: Telegram language -> RU/EN default, user can change.

**Functions:**
- Upsert profile.
- Mark `is_onboarded = false` until first dump.
- Use Telegram BackButton between steps.

### 6.3 Onboarding: First Dump

**Route:** `/onboarding/first-dump`  
**Based on:** `mobile/app/(onboarding)/first-dump.tsx`

**Modes:**
- Text input.
- Web voice recording when supported.
- Bot voice fallback: user sends voice note to bot; bot replies with Mini App link to results.

**Functions:**
- Submit dump.
- Show AI processing state.
- Reveal top 3 tasks one by one.
- Finish onboarding and schedule default reflection reminder.

### 6.4 Today

**Route:** `/today`  
**Based on:** `mobile/app/(app)/index.tsx`

**Content:**
- Greeting.
- Localized date.
- Reflection prompt after evening threshold.
- Current reflection streak card.
- Today's tasks.
- Pending dump queue indicator.
- Floating or Telegram BottomButton action for new dump.

**Functions:**
- Pull-to-refresh equivalent.
- Open task detail.
- Open reflection.
- Open dump composer.
- Empty state with first-dump CTA.

### 6.5 Dump Composer

**Route:** `/dump`  
**Based on:** `mobile/app/(app)/dump.tsx`

**Modes:**
- Text.
- Voice via MediaRecorder when available.
- Bot voice fallback instructions.

**Functions:**
- Enforce 20k text character limit.
- Enforce max audio duration and file size before upload.
- Queue text dump offline in IndexedDB/DeviceStorage.
- For voice, queue only if browser can persist Blob safely; otherwise show retry state.
- Handle 402 premium limit -> Paywall.
- Navigate to Result on success.

### 6.6 Dump Result

**Route:** `/result/:dumpId` or stateful result route  
**Based on:** `mobile/app/(app)/result.tsx`

**Content:**
- Voice transcription preview when present.
- Created task list.
- Sphere filter.
- Today's top 3 highlight.
- Done button to Today.

**Functions:**
- Open created task detail.
- Refresh result from backend by `dump_id` rather than relying only on route JSON.

### 6.7 All Tasks / History

**Route:** `/tasks`  
**Based on:** `mobile/app/(app)/all.tsx`

**Content:**
- Sphere filters: all, work, family, study, health, travel, finance, goals.
- Free-history banner for non-premium.
- Task list.

**Functions:**
- Query `/tasks/`.
- Server-side history cutoff remains authoritative.
- Open Paywall from cutoff banner.
- Search can be added in Telegram version because keyboard entry is natural on web.

### 6.8 Task Detail

**Route:** `/tasks/:id`  
**Based on:** `mobile/app/(app)/task/[id].tsx`

**Content:**
- Sphere pill.
- Editable title.
- Notes.
- Deadline.
- Reminder time.
- Goal link if present.

**Functions:**
- Mark done.
- Edit title.
- Delete with confirmation.
- Optional new Telegram feature: set/update reminder in server table, bot sends reminder.
- Optional new Telegram feature: link/unlink goal from task from detail screen.

### 6.9 Goals List

**Route:** `/goals`  
**Based on:** `mobile/app/(app)/goals.tsx`

**Content:**
- Status tabs: active, paused, achieved, archived.
- Goal cards with target date and progress.
- Create button.

**Functions:**
- Query by status.
- Respect free active goal limit.
- Empty state CTA.
- Refresh.

### 6.10 New Goal

**Route:** `/goals/new`  
**Based on:** `mobile/app/(app)/goals/new.tsx`

**Fields:**
- Title.
- Description.
- Target date.
- Sphere.
- Status active/paused.

**Functions:**
- Validate title and target date.
- Create goal.
- On 402/limit reached open Paywall.

### 6.11 Goal Detail

**Route:** `/goals/:id`  
**Based on:** `mobile/app/(app)/goals/[id].tsx`

**Content:**
- Editable title.
- Target date.
- Computed progress.
- Manual progress if retained.
- Status pills.
- Linked tasks.

**Functions:**
- Change status.
- Delete.
- Open linked task detail.
- Refresh progress.

### 6.12 Reflection History

**Route:** `/reflection`  
**Based on:** `mobile/app/(app)/reflection/index.tsx`

**Content:**
- Streak.
- Reflection rows with date, notes preview, mood, energy, goal-aligned badge.
- Backfill yesterday banner.
- Today FAB / BottomButton.

**Functions:**
- List last 30 reflections.
- Open detail.
- Open today reflection.

### 6.13 Today Reflection

**Route:** `/reflection/today`  
**Based on:** `mobile/app/(app)/reflection/today.tsx`

**Content:**
- Daily summary: completed tasks, goal-aligned tasks, goals with progress.
- Mood selector 1-5.
- Energy selector 1-5.
- Notes field with 4000 char limit.

**Functions:**
- Create or update today's reflection.
- Reschedule bot reminder after save.
- Show success and return.

### 6.14 Reflection Detail

**Route:** `/reflection/:date`  
**Based on:** `mobile/app/(app)/reflection/[date].tsx`

**Content:**
- Date.
- Mood card.
- Energy card.
- Stats.
- Notes.

**Functions:**
- Edit today by routing to `/reflection/today`.
- Delete reflection.
- Retry load.

### 6.15 Reflection Settings

**Route:** `/reflection/settings`  
**Based on:** `mobile/app/(app)/reflection/settings.tsx`

**Content:**
- Daily reflection reminder toggle.
- Time input.
- Timezone hint.
- Bot permission/status hint.

**Functions:**
- Save settings on backend.
- Disable reminders.
- Send test reminder.
- Explain that reminders arrive as bot messages, not system push.

### 6.16 Premium / Paywall

**Route:** `/premium`  
**Based on:** `mobile/app/(app)/paywall.tsx`

**Content:**
- Premium benefits:
  - unlimited dumps.
  - unlimited active goals.
  - full history.
  - priority AI tier.
- Telegram Stars price.
- Subscription status.
- Legal links.
- Payment support link/command.

**Functions:**
- Create invoice.
- Open Telegram invoice.
- Poll/refresh status.
- Restore is replaced by "refresh purchase status" because Telegram payments are bot-account based.
- Show active/cancelled subscription state.

### 6.17 Profile

**Route:** `/profile`  
**Based on:** `mobile/app/(app)/profile.tsx`

**Content:**
- Telegram avatar/photo if available.
- Name.
- Telegram username/provider badge.
- Task stats.
- Premium badge/expiry.
- AI memory preview.
- Reminder settings link.
- Language switcher.
- Legal/support links.
- End session.
- Delete account.

**Functions:**
- Refresh premium.
- Open notification/reflection settings.
- Open payment support.
- Delete account with active subscription warning.
- Clear local token/session on end session.

### 6.18 Legal / Support

**Routes:** `/legal/privacy`, `/legal/terms`, `/support` or external links  
**Based on:** existing `docs/legal-site`.

**Functions:**
- Open legal pages in Telegram/browser.
- Payment support instructions for `/paysupport`.
- Data deletion explanation.

### 6.19 Error And Utility Screens

**Routes:**
- `/unsupported`
- `/offline`
- `/account-pending-deletion`
- `/not-found`
- `/maintenance`

**Functions:**
- Explain if app is opened outside Telegram.
- Retry failed auth.
- Show queued dumps.
- Show account deletion purge date.

---

## 7. Bot Plan

### Commands

- `/start` - welcome, open Mini App.
- `/help` - explain text/voice dump and app link.
- `/settings` - reminder/settings links.
- `/premium` - open paywall.
- `/paysupport` - required payment support entrypoint.
- `/deleteaccount` - sends Mini App deep link to profile deletion screen; deletion itself remains in Mini App/backend confirmation flow.

### Bot Message Inputs

Text message:
1. User sends text to bot.
2. Backend treats it as dump text.
3. Bot replies with summary and button: "Open tasks".

Voice message:
1. User sends Telegram voice note to bot.
2. Backend downloads file via Bot API.
3. Reuses existing STT + parse pipeline.
4. Bot replies with transcription preview and Mini App result link.

### Bot Notifications

- Evening reflection reminder.
- Morning planning reminder.
- Task reminder.
- Payment success/failure.
- Account deletion scheduled.

---

## 8. API Plan

### New Telegram Auth

- `POST /telegram/auth/session`
  - Input: `{ init_data: string }`
  - Output: `{ access_token, expires_at, user, profile, is_new_user, start_param }`

- `POST /telegram/auth/refresh`
  - Optional if we want long-lived refresh without requiring a fresh Mini App open.

### New Telegram Payments

- `POST /telegram/payments/invoice`
  - Auth required.
  - Input: `{ plan_id: "premium_monthly" }`
  - Output: `{ invoice_link, payload }`

- `POST /telegram/payments/refresh`
  - Auth required.
  - Reconciles `user_premium` from latest known Telegram payment rows.

### New Telegram Webhook

- `POST /telegram/webhook`
  - Secret path or secret header.
  - Handles:
    - messages.
    - voice messages.
    - callback queries.
    - pre-checkout queries.
    - successful payments.
    - refunded payments where available.

### Reminder Settings

- `GET /telegram/reminders/settings`
- `PUT /telegram/reminders/settings`
- `POST /telegram/reminders/test`

### Existing API Reuse

Keep unchanged where possible:
- `/auth/me`
- `/auth/profile`
- `/auth/account`
- `/dump/text`
- `/dump/voice`
- `/tasks/today`
- `/tasks/`
- `/tasks/{id}`
- `/goals/*`
- `/reflections/*`
- `/memory/profile`
- `/premium/status`

---

## 9. Feature Mapping

| Existing mobile capability | Telegram Mini App plan |
| --- | --- |
| Supabase email/password | Removed from Telegram flow; use Telegram identity |
| Apple/Google OAuth | Native mobile only |
| RevenueCat | Native mobile only |
| Paywall | Telegram Stars invoice |
| expo-notifications | Bot reminders |
| expo-audio | MediaRecorder + bot voice-note fallback |
| MMKV persisted store | IndexedDB/localStorage/Telegram DeviceStorage |
| Expo Router tabs | Web routes + Telegram BackButton + compact nav |
| i18next locales | Reuse RU/EN keys and add Telegram-specific keys |
| Sentry RN | Sentry browser SDK |
| Account deletion | Reuse endpoint; add Telegram rows to cleanup |
| Legal site | Reuse existing `second-brain.app/privacy|terms` |

---

## 10. Implementation Phases

### Phase 0 - Spec And Decisions

- Create Spec Kit feature `006-telegram-miniapp`.
- Confirm bot username, Mini App name, domain, and deployment target.
- Decide Stars price and plan IDs.
- Decide whether Telegram users can later link to existing Supabase mobile accounts.
- Decide whether bot text/voice dump is included in first release. Recommendation: yes, because it is a natural Telegram behavior and improves voice reliability.

### Phase 1 - Skeleton

- Create `second-brain/telegram-miniapp`.
- Add Vite React TypeScript setup.
- Add Telegram SDK wrapper.
- Add theme, viewport, BackButton, haptics helpers.
- Add Sentry browser setup.
- Add API client with Bearer token injection.
- Add routes and placeholder screens for every target screen.
- Add CI commands:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Phase 2 - Telegram Auth

- Add backend env vars:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `APP_SESSION_JWT_SECRET`
  - `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`
- Implement `services/telegram_init_data.py`.
- Add `telegram_accounts` migration.
- Implement Supabase auth-user bootstrap for Telegram accounts.
- Extend `auth.py` to accept app session JWT.
- Implement `POST /telegram/auth/session`.
- Build Launch screen and session store.
- Tests:
  - valid initData.
  - tampered initData rejected.
  - stale auth_date rejected.
  - existing Telegram user maps to same internal UUID.
  - deleted account receives 410/pending deletion state.

### Phase 3 - Core Dump And Tasks

- Port Today screen.
- Port Dump screen text mode.
- Implement result route backed by `dump_id`.
- Port All Tasks screen.
- Port Task Detail screen.
- Add web dump queue for text.
- Add MediaRecorder voice capture where supported.
- Add clear voice fallback to bot.
- Tests:
  - text dump success.
  - 402 opens paywall route.
  - free history banner.
  - task update/delete.
  - offline text queue drains.

### Phase 4 - Goals

- Port Goals list.
- Port New Goal.
- Port Goal Detail.
- Handle active-goal free limit.
- Add linked task navigation.
- Tests:
  - create goal validation.
  - status tabs.
  - progress render.
  - goal limit opens paywall.

### Phase 5 - Reflections And Reminders UI

- Port Reflection History.
- Port Today Reflection.
- Port Reflection Detail.
- Port Reflection Settings.
- Add backend reminder settings.
- Add scheduler/cron for reflection reminders.
- Tests:
  - create/update reflection.
  - daily summary.
  - settings save.
  - reminder job selects correct users.

### Phase 6 - Telegram Bot

- Create bot service client.
- Configure webhook.
- Implement `/start`, `/help`, `/settings`, `/premium`, `/paysupport`.
- Implement text-message dump.
- Implement voice-message dump.
- Add deep-link buttons into Mini App.
- Tests:
  - webhook secret required.
  - text message creates dump.
  - voice message downloads file and calls STT path.
  - bot replies with correct startapp link.

### Phase 7 - Stars Premium

- Add payment migration.
- Implement invoice creation.
- Implement pre-checkout handling.
- Implement successful payment handling.
- Upsert `user_premium`.
- Port Paywall with Stars.
- Add `/paysupport` response.
- Tests:
  - invoice payload signed/unique.
  - pre-checkout validates user/plan.
  - successful payment activates premium.
  - refund/cancel path deactivates when appropriate.

### Phase 8 - Profile, Legal, Account Deletion

- Port Profile.
- Add language switcher.
- Add AI memory preview.
- Add legal/support links.
- Add account deletion confirmation.
- Update cleanup cascade to include Telegram tables.
- Tests:
  - profile loads Telegram metadata.
  - delete account hides account and cleans Telegram rows after grace.
  - sign out clears local token and cache.

### Phase 9 - QA And Release

- Cross-client manual QA:
  - Telegram iOS.
  - Telegram Android.
  - Telegram Desktop.
  - external browser unsupported state.
- Responsive QA:
  - small mobile viewport.
  - full-screen mode.
  - compact mode if used.
  - keyboard open with textareas.
- Theme QA:
  - Telegram dark.
  - Telegram light.
  - custom accent colors.
- Payment QA:
  - test Stars invoices.
  - successful payment webhook.
  - support/refund flow.
- Security QA:
  - tampered initData.
  - replayed initData.
  - expired app session token.
  - webhook secret.
- Production setup:
  - BotFather Mini App URL.
  - menu button.
  - webhook URL.
  - domain HTTPS.
  - Sentry release.
  - Railway vars.
  - deploy static client.

---

## 11. Testing Matrix

### Backend Unit Tests

- Telegram initData validation.
- Session JWT issue/verify.
- Telegram account bootstrap.
- Payment invoice payload.
- Webhook update parsing.
- Reminder settings validation.

### Backend Integration Tests

- New Telegram account creates auth user/profile.
- Existing account reuses same user ID.
- Dump/text works with app session JWT.
- Goals/reflections work with app session JWT.
- Premium gating works after Telegram payment.
- Cleanup deletes Telegram-specific rows.

### Frontend Tests

- Route guards.
- Launch auth success/failure.
- Screen render for every route.
- API error handling.
- Paywall payment state.
- Reflection form validation.
- Goal form validation.
- Dump queue behavior.

### End-To-End Smoke Tests

- Open Mini App from bot.
- Complete onboarding.
- Submit text dump.
- Send voice note to bot.
- Complete task.
- Create goal.
- Complete daily reflection.
- Buy premium in test environment.
- Receive reminder.
- Delete account.

---

## 12. Data And Privacy

- Telegram ID is personal data; document it in privacy policy.
- Store Telegram username/name/photo only for account UX and bot communication.
- Do not store `initData` raw after session creation unless needed for debugging; if logged, redact.
- Bot voice notes are processed like existing voice dumps; raw audio should not be stored unless explicitly required.
- Existing account deletion must cover Telegram mapping, reminders, and payment records where allowed.
- Payment records may require retention; separate hard-delete policy from personal content deletion if needed.

---

## 13. Open Decisions

1. **Account linking:** Should a user who already has the mobile app be able to link Telegram to the same account? Recommendation: not in first release unless we add a secure link code flow.
2. **Stars price:** Choose Telegram Stars monthly price and whether it maps exactly to `$4.99` perceived value.
3. **Voice priority:** Include bot voice-note dump in first release? Recommendation: yes.
4. **Deployment:** Vercel/Cloudflare Pages for Mini App static frontend vs Railway static service. Recommendation: Vercel or Cloudflare Pages for static client, Railway remains backend.
5. **Bot framework:** Direct FastAPI webhook handling vs aiogram. Recommendation: direct handling for small command surface; add aiogram only if bot grows.
6. **Reminder scheduler:** Railway cron hitting admin endpoint vs APScheduler. Recommendation: external cron/admin endpoint for reliability and simpler scaling.
7. **Shared types:** Generate TypeScript types from OpenAPI or manually maintain `types/api.ts`. Recommendation: generate after Telegram auth endpoints stabilize.

---

## 14. Acceptance Criteria

- A new Telegram user can open the Mini App, complete onboarding, submit a first dump, and see today's tasks without email/password.
- Existing backend task, goal, reflection, memory, premium, and deletion behavior remains unchanged for native mobile users.
- Telegram Mini App uses Telegram Stars for premium purchases and never shows RevenueCat purchase UI.
- Bot can process text and voice dumps and return a Mini App deep link to results.
- Daily reflection reminders arrive as Telegram bot messages at the saved local time.
- All screens listed in this plan exist and have loading, empty, error, and success states.
- RU and EN are complete for all Telegram-specific UI.
- Tampered or stale Telegram auth data cannot create a session.
- Account deletion removes or disables Telegram-specific data according to the existing 30-day grace policy.
- Typecheck, backend tests, frontend tests, and production build pass before launch.

---

## 15. Suggested First Task Breakdown

- [ ] Create Spec Kit feature spec for Telegram Mini App migration.
- [ ] Add backend Telegram env vars and tests.
- [ ] Implement initData validation.
- [ ] Add `telegram_accounts` migration.
- [ ] Implement `/telegram/auth/session`.
- [ ] Scaffold `second-brain/telegram-miniapp`.
- [ ] Implement Launch/Auth screen.
- [ ] Port Today, Dump, Result, Tasks.
- [ ] Add bot webhook and `/start`.
- [ ] Add bot text/voice dump.
- [ ] Port Goals.
- [ ] Port Reflections.
- [ ] Add Telegram reminders.
- [ ] Add Stars paywall.
- [ ] Port Profile/account deletion.
- [ ] Run cross-client Telegram QA.
