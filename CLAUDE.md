<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`.specify/specs/005-production-readiness/plan.md`
<!-- SPECKIT END -->

# Second Brain

Personal AI assistant: voice/text dump → structured tasks → goal-aligned planning → evening reflection.

## Стек
- **Backend:** Python 3.12, FastAPI + Pydantic V2, PyJWT (Supabase JWT), slowapi, Sentry
- **Mobile:** Expo SDK 53, Expo Router v4, TypeScript strict, Zustand + MMKV, expo-audio (NOT expo-av), @sentry/react-native, expo-notifications, react-native-purchases, expo-apple-authentication, @react-native-google-signin/google-signin
- **DB:** Supabase Postgres + RLS + `pgvector halfvec(1536)` + HNSW
- **AI router (cheapest-first):** Groq Llama 3.3 70B → Claude Haiku 4.5 → Claude Sonnet 4.6
- **STT:** gpt-4o-mini-transcribe → HuggingFace Whisper (fallback через `router.huggingface.co/hf-inference/models/<HUGGINGFACE_STT_MODEL>`, по умолчанию `openai/whisper-large-v3`); при сбое STT `POST /dump/audio` отдаёт 503
- **Premium:** RevenueCat → backend webhook → `user_premium` table
- **Deploy:** Railway (Dockerfile) для backend, EAS для mobile

## Структура
- `second-brain/backend/` — FastAPI app (api/, services/, models/, tests/)
- `second-brain/mobile/` — Expo app (app/ Router screens, services/, store/, components/)
- `second-brain/supabase/migrations/` — SQL миграции (001–009; 009 — account deletion)
- `second-brain/docs/` — setup guides (`oauth-setup.md`, `revenuecat-setup.md`)
- `second-brain/mobile/locales/` — i18n resources (`ru.json`, `en.json`)
- `second-brain/mobile/plugins/withPrivacyManifest.js` — Expo config plugin, копирует `ios/PrivacyInfo.xcprivacy.template.plist` в билд
- `second-brain/telegram-miniapp/src/screens/finance/` — Hi-fi редизайн раздела Финансы (12 экранов: Overview, Transactions, Budgets, Goals, NetWorth, Assets, Income, Subscriptions, Debts, Taxes, AI, Analytics + More-хаб). Дизайн-система в `finance.css` под скоупом `.finance-app` (Manrope + JetBrains Mono, красный hero, кремовый фон, pill-кнопки). Роуты `/finance/*` в `src/app/routes.tsx`; общий shell в `components/shell.tsx` (FinancePhone, FinanceTabBar, Pill, Alert, Segmented, Skeleton, EmptyState, ErrorState), иконки в `components/Icon.tsx`. Все экраны подключены к API через `@tanstack/react-query`. Формы создания (10 sheet-форм) в `components/forms.tsx` + общий `Sheet` в `components/Sheet.tsx` — открываются с FAB/кнопок на каждом экране, пишут через `createFinance*` и инвалидируют `["finance"]` query keys.
- Backend Finance API: `second-brain/backend/api/finance.py` (роутер `/finance`, подключён в `main.py`) + `models/finance.py` + `services/finance_analyzer.py`. Миграция `second-brain/supabase/migrations/014_finance.sql`. Тесты — `backend/tests/test_finance_api.py`.
- Onboarding state (mini-app): `second-brain/telegram-miniapp/src/services/onboarding.ts` хранит локальный флаг прогресса; `routeAfterTelegramSession` ведёт в `/onboarding/setup`, если `is_new_user || !user.is_onboarded || !isOnboardingComplete()`.
- Launch splash (mini-app): `second-brain/telegram-miniapp/src/screens/launch/LaunchScreen.tsx` + SVG-логотип `src/assets/AppLogo.tsx` + блок стилей `.launch-splash` в `src/styles.css`. Тёмный фон с радиальным свечением, бренд `AI ASSISTANT` (Manrope 800), pill-статус со спиннером (`launch.statusConnecting` пока идёт `createTelegramSession` / `createDevSession`); после bootstrap — статусный текст и кнопки fallback. Тест: `tests/launch.test.tsx`.
- Dev-auth: `POST /telegram/auth/dev-session` (включается `TELEGRAM_DEV_AUTH_ENABLED=true` в `.env`) выдаёт JWT для локальной разработки без Telegram initData. LaunchScreen в `import.meta.env.DEV` сам дёргает endpoint; в проде endpoint возвращает 404. Минимум обязательных env для dev: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `APP_SESSION_JWT_SECRET`, `TELEGRAM_DEV_AUTH_ENABLED=true`; AI/payment ключи (`ANTHROPIC_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, `ADMIN_CLEANUP_SECRET`) опциональны в dev (default пустые), но обязательны в проде.
- Backend `config.py` ищет `.env` рекурсивно вверх от `second-brain/backend/` до корня репозитория — можно держать единый `/AI-asistent/.env` для всех компонентов; локальный `backend/.env` (если есть) переопределяет корневой через `os.environ.setdefault`.
- `docs/legal/` — privacy policy + terms (RU/EN)
- `docs/legal-site/` — Next.js сайт, рендерит `docs/legal/*.md` на `https://second-brain.app/privacy|/terms`
- `docs/store-listing/` — App Store / Play Console тексты + placeholder-скриншоты
- `docs/runbooks/` — operational runbooks (`account-cleanup.md`)
- `docs/superpowers/plans/` — Superpowers-style планы (реализация + reliability)
- `.specify/` — Spec Kit artefacts (gitignored, локально)
  - `memory/constitution.md` — v1.0.0, 7 принципов, обязательны для всех новых фич
  - `specs/001-goals-first-class/` — Goals
  - `specs/002-evening-reflection/` — Reflection
  - `specs/003-oauth-signin/` — OAuth
  - `specs/004-paywall-premium/` — Paywall
  - `specs/005-production-readiness/` — Production readiness (account deletion, history cutoff, i18n, RLS tests, store listing)

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
- **AI-вызовы:** всегда через `services/ai_router.py` с per-user token budget gating (Principle III). `services/parser.py` имеет локальный `_fallback_parse_dump` — если LLM-tier'ы не вернули валидный JSON, taski всё равно создаются локально (помечаются заметкой), а не выкидывается ошибка.
- **Premium gating:** fail-safe to FREE если `user_premium` row отсутствует — никогда не давать premium по ошибке

## Переменные окружения
- `second-brain/backend/.env.example` — backend template
- `second-brain/mobile/.env.example` — mobile template
- Railway Variables — серверные значения (`SUPABASE_*`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_DSN`, `REVENUECAT_WEBHOOK_SECRET`, `DAILY_FREE_TOKEN_BUDGET`, `DAILY_PREMIUM_TOKEN_BUDGET`)
- EAS secrets — mobile build-time (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`)

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
