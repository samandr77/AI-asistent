<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`.specify/specs/006-telegram-miniapp/plan.md`

Roadmap and stage task planning also live in `docs/superpowers/plans/telegram-miniapp/`.
<!-- SPECKIT END -->

# Second Brain

Personal AI assistant: voice/text dump → structured tasks → goal-aligned planning → evening reflection.

## Стек
- **Backend:** Python 3.12, FastAPI + Pydantic V2, PyJWT (Supabase JWT), slowapi, Sentry
- **Mobile:** Expo SDK 53, Expo Router v4, TypeScript strict, Zustand + MMKV, expo-audio (NOT expo-av), @sentry/react-native, expo-notifications, react-native-purchases, expo-apple-authentication, @react-native-google-signin/google-signin
- **DB:** Supabase Postgres + RLS + `pgvector halfvec(1536)` + HNSW
- **AI router (cheapest-first):** Groq Llama 3.3 70B → Codex Haiku 4.5 → Codex Sonnet 4.6
- **STT:** gpt-4o-mini-transcribe → HuggingFace Whisper (fallback)
- **Premium:** RevenueCat → backend webhook → `user_premium` table
- **Telegram Mini App (current feature):** React + TypeScript strict + Vite, Telegram WebApp SDK wrapper, Telegram `initData` auth, Telegram bot webhook, Telegram Stars premium
- **Deploy:** Railway (Dockerfile) для backend, EAS для mobile, static HTTPS hosting для Telegram Mini App

## Структура
- `second-brain/backend/` — FastAPI app (api/, services/, models/, tests/)
- `second-brain/mobile/` — Expo app (app/ Router screens, services/, store/, components/)
- `second-brain/telegram-miniapp/` — React/Vite Telegram Mini App frontend
- `second-brain/supabase/migrations/` — SQL миграции (001–013; 013 — Telegram Stars premium store)
- `second-brain/docs/` — setup guides (`oauth-setup.md`, `revenuecat-setup.md`)
- `second-brain/mobile/locales/` — i18n resources (`ru.json`, `en.json`)
- `second-brain/mobile/plugins/withPrivacyManifest.js` — Expo config plugin, копирует `ios/PrivacyInfo.xcprivacy.template.plist` в билд
- `docs/legal/` — privacy policy + terms (RU/EN)
- `docs/legal-site/` — Next.js сайт, рендерит `docs/legal/*.md` на `https://second-brain.app/privacy|/terms`
- `docs/store-listing/` — App Store / Play Console тексты + placeholder-скриншоты
- `docs/runbooks/` — operational runbooks (`account-cleanup.md`)
- `docs/superpowers/plans/` — Superpowers-style планы (реализация + reliability)
  - `telegram-miniapp/roadmap.md` — roadmap переноса в Telegram Mini App
  - `telegram-miniapp/stages/*.md` — подробное описание каждого этапа
  - `telegram-miniapp/tasks.md` — полный чеклист задач для реализации системы
- `.specify/` — Spec Kit artefacts (gitignored, локально)
  - `memory/constitution.md` — v1.0.0, 7 принципов, обязательны для всех новых фич
  - `specs/001-goals-first-class/` — Goals
  - `specs/002-evening-reflection/` — Reflection
  - `specs/003-oauth-signin/` — OAuth
  - `specs/004-paywall-premium/` — Paywall
  - `specs/005-production-readiness/` — Production readiness (account deletion, history cutoff, i18n, RLS tests, store listing)
  - `specs/006-telegram-miniapp/` — planned/current Telegram Mini App migration

## Команды

### Backend
- Запуск: `cd second-brain/backend && uvicorn main:app --reload`
- Тесты: `cd second-brain/backend && pytest`
- Линтер: `cd second-brain/backend && ruff check .`

### Mobile
- Запуск: `cd second-brain/mobile && npx expo start --dev-client` (dev-build required из-за нативных модулей)
- Type check: `cd second-brain/mobile && npx tsc --noEmit`
- Тесты: `cd second-brain/mobile && npx jest`
- EAS билд: `cd second-brain/mobile && eas build --profile development --platform all`

### Telegram Mini App
- Запуск: `cd second-brain/telegram-miniapp && npm run dev`
- Type check: `cd second-brain/telegram-miniapp && npm run typecheck`
- Тесты: `cd second-brain/telegram-miniapp && npm test`
- Production build: `cd second-brain/telegram-miniapp && npm run build`

## Соглашения
- **Новые фичи — через Spec Kit flow**: `/speckit-specify` → `/speckit-plan` (Constitution Check обязателен) → `/speckit-tasks` → `/speckit-implement`
- **Constitution gates** в `.specify/memory/constitution.md` — приоритет Principle VI: полный функционал, никаких MVP shortcuts
- **Backend:** все user-owned таблицы с RLS; `.env` никогда не коммитить; missing env var → падение при старте (Principle IV)
- **Mobile:** expo-audio (не expo-av); Zustand + MMKV для персистентности; Expo Router v4
- **Telegram Mini App:** отдельный web frontend, не переносить Expo native modules напрямую в Telegram WebView
- **Telegram auth:** backend валидирует raw `Telegram.WebApp.initData`; `initDataUnsafe` нельзя использовать как доверенный источник
- **Telegram premium:** digital premium внутри Telegram продавать через Telegram Stars; RevenueCat остаётся только для native mobile
- **Telegram reminders:** заменить Expo local notifications на сообщения Telegram bot-а
- **AI-вызовы:** всегда через `services/ai_router.py` с per-user token budget gating (Principle III)
- **Premium gating:** fail-safe to FREE если `user_premium` row отсутствует — никогда не давать premium по ошибке

## Переменные окружения
- `second-brain/backend/.env.example` — backend template
- `second-brain/mobile/.env.example` — mobile template
- Railway Variables — серверные значения (`SUPABASE_*`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_DSN`, `REVENUECAT_WEBHOOK_SECRET`, `DAILY_FREE_TOKEN_BUDGET`, `DAILY_PREMIUM_TOKEN_BUDGET`)
- EAS secrets — mobile build-time (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`)
- Telegram/Railway vars — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_MINIAPP_URL`, `APP_SESSION_JWT_SECRET`, `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`, `TELEGRAM_PREMIUM_MONTHLY_STARS`

## Release checklist
- `second-brain/RELEASE_CHECKLIST.md` — 12 шагов до прода (обновлён в 005-production-readiness)
- OAuth активация: `second-brain/docs/oauth-setup.md`
- RevenueCat активация: `second-brain/docs/revenuecat-setup.md`
- Cleanup-cron runbook: `docs/runbooks/account-cleanup.md`
- Legal site deploy: `docs/legal-site/README.md`

## Admin / automation
- `DELETE /auth/account` — soft-delete, grace 30 дней. Тесты: `backend/tests/test_account_deletion.py`.
- `POST /admin/cleanup-deleted` — hard-delete по истечении grace. Secret: `ADMIN_CLEANUP_SECRET`. Cron: `.github/workflows/cleanup-cron.yml` (ежедневно 04:15 UTC).
- RLS integration suite: `backend/tests/test_supabase_rls.py` (marker: `integration`). Запуск вручную через `.github/workflows/rls-integration.yml`.
- Telegram planned: `POST /telegram/webhook` — bot updates, bot dumps, Stars payments; endpoint must require webhook secret.
- Telegram planned: reminder cron/admin endpoint sends due reflection/task reminders through bot messages.
