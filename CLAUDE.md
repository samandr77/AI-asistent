<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# Second Brain

Personal AI assistant: voice/text dump → structured tasks → goal-aligned planning → evening reflection.

## Стек
- **Backend:** Python 3.12, FastAPI + Pydantic V2, PyJWT (Supabase JWT), slowapi, Sentry
- **Mobile:** Expo SDK 53, Expo Router v4, TypeScript strict, Zustand + MMKV, expo-audio (NOT expo-av), @sentry/react-native, expo-notifications, react-native-purchases, expo-apple-authentication, @react-native-google-signin/google-signin
- **DB:** Supabase Postgres + RLS + `pgvector halfvec(1536)` + HNSW
- **AI router (cheapest-first):** Groq Llama 3.3 70B → Claude Haiku 4.5 → Claude Sonnet 4.6
- **STT:** gpt-4o-mini-transcribe → HuggingFace Whisper (fallback)
- **Premium:** RevenueCat → backend webhook → `user_premium` table
- **Deploy:** Railway (Dockerfile) для backend, EAS для mobile

## Структура
- `second-brain/backend/` — FastAPI app (api/, services/, models/, tests/)
- `second-brain/mobile/` — Expo app (app/ Router screens, services/, store/, components/)
- `second-brain/supabase/migrations/` — SQL миграции (001–007)
- `second-brain/docs/` — setup guides (`oauth-setup.md`, `revenuecat-setup.md`)
- `docs/superpowers/plans/` — Superpowers-style планы (реализация + reliability)
- `.specify/` — Spec Kit artefacts (gitignored, локально)
  - `memory/constitution.md` — v1.0.0, 7 принципов, обязательны для всех новых фич
  - `specs/001-goals-first-class/` — Goals
  - `specs/002-evening-reflection/` — Reflection
  - `specs/003-oauth-signin/` — OAuth
  - `specs/004-paywall-premium/` — Paywall

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

## Соглашения
- **Новые фичи — через Spec Kit flow**: `/speckit-specify` → `/speckit-plan` (Constitution Check обязателен) → `/speckit-tasks` → `/speckit-implement`
- **Constitution gates** в `.specify/memory/constitution.md` — приоритет Principle VI: полный функционал, никаких MVP shortcuts
- **Backend:** все user-owned таблицы с RLS; `.env` никогда не коммитить; missing env var → падение при старте (Principle IV)
- **Mobile:** expo-audio (не expo-av); Zustand + MMKV для персистентности; Expo Router v4
- **AI-вызовы:** всегда через `services/ai_router.py` с per-user token budget gating (Principle III)
- **Premium gating:** fail-safe to FREE если `user_premium` row отсутствует — никогда не давать premium по ошибке

## Переменные окружения
- `second-brain/backend/.env.example` — backend template
- `second-brain/mobile/.env.example` — mobile template
- Railway Variables — серверные значения (`SUPABASE_*`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_DSN`, `REVENUECAT_WEBHOOK_SECRET`, `DAILY_FREE_TOKEN_BUDGET`, `DAILY_PREMIUM_TOKEN_BUDGET`)
- EAS secrets — mobile build-time (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`)

## Release checklist
- `second-brain/RELEASE_CHECKLIST.md` — 9 шагов до прода
- OAuth активация: `second-brain/docs/oauth-setup.md`
- RevenueCat активация: `second-brain/docs/revenuecat-setup.md`
