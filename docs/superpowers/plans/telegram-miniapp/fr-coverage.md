# Telegram Mini App FR Coverage

**Spec:** `.specify/specs/006-telegram-miniapp/spec.md`  
**Purpose:** map every functional requirement to an implemented path, test path, or required release/manual path.

| FR | Implemented path | Evidence |
| --- | --- | --- |
| FR-001 | Mini App launch/deep link routing through `second-brain/telegram-miniapp/src/screens/launch/LaunchScreen.tsx` and `second-brain/backend/services/telegram_deeplinks.py` | `second-brain/telegram-miniapp/tests/launch.test.tsx`, `docs/runbooks/telegram-miniapp.md` |
| FR-002 | Telegram init data validation in `second-brain/backend/services/telegram_init_data.py` and session endpoint `second-brain/backend/api/telegram_auth.py` | `second-brain/backend/tests/test_telegram_auth.py` |
| FR-003 | Telegram account bootstrap in `second-brain/backend/services/telegram_users.py` with `telegram_accounts` migration | `second-brain/backend/tests/test_telegram_auth.py`, `second-brain/supabase/migrations/010_telegram_accounts.sql` |
| FR-004 | Launch routing and onboarding screens in `second-brain/telegram-miniapp/src/screens/launch/LaunchScreen.tsx` and `src/screens/onboarding/*` | `second-brain/telegram-miniapp/tests/launch.test.tsx` |
| FR-005 | Deleted-account session handling and pending deletion screen | `second-brain/backend/tests/test_telegram_auth.py`, `second-brain/telegram-miniapp/src/screens/account/AccountPendingDeletionScreen.tsx` |
| FR-006 | Full route map in `second-brain/telegram-miniapp/src/app/routes.tsx` | `second-brain/telegram-miniapp/tests/launch.test.tsx` and route render tests |
| FR-007 | Telegram theme and viewport adapters in `src/telegram/sdk.ts`, `src/styles.css`, and app providers | `second-brain/telegram-miniapp/tests/launch.test.tsx`; manual theme QA remains in release tasks |
| FR-008 | Back navigation adapter in Mini App routing/Telegram SDK integration | `second-brain/telegram-miniapp/src/telegram/sdk.ts`, manual nested-route QA remains in release tasks |
| FR-009 | RU/EN resources in `second-brain/telegram-miniapp/src/locales/ru.json` and `en.json` | `npm run typecheck`, render tests |
| FR-010 | Text dump flow in `second-brain/telegram-miniapp/src/screens/dump/DumpScreen.tsx` | `second-brain/telegram-miniapp/tests/dump.test.tsx` |
| FR-011 | In-app voice recording plus bot voice fallback | `second-brain/telegram-miniapp/tests/dump.test.tsx`, `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-012 | Existing AI budget/tier enforcement reused in backend dump and bot webhook flows | `second-brain/backend/tests/test_ai_budget.py`, `test_telegram_webhook.py` |
| FR-013 | Result screen and dump-result reload endpoint | `second-brain/telegram-miniapp/tests/dump.test.tsx`, `second-brain/backend/tests/test_dump.py` |
| FR-014 | Durable pending text dump queue | `second-brain/telegram-miniapp/tests/dumpQueue.test.ts` |
| FR-015 | User-facing dump errors and upload guards | `second-brain/telegram-miniapp/tests/dump.test.tsx` |
| FR-016 | Today tasks screen | `second-brain/telegram-miniapp/tests/today.test.tsx` |
| FR-017 | All tasks screen with sphere filtering/history cutoff | `second-brain/telegram-miniapp/tests/tasks.test.tsx`, `second-brain/backend/tests/test_tasks_history_cutoff.py` |
| FR-018 | Task detail/edit/done/delete | `second-brain/telegram-miniapp/tests/tasks.test.tsx` |
| FR-019 | Free history cutoff and premium upsell | `second-brain/backend/tests/test_tasks_history_cutoff.py`, `second-brain/telegram-miniapp/tests/tasks.test.tsx` |
| FR-020 | Goals status tabs/list | `second-brain/telegram-miniapp/tests/goals.test.tsx` |
| FR-021 | New goal form | `second-brain/telegram-miniapp/tests/goals.test.tsx` |
| FR-022 | Goal progress and linked tasks | `second-brain/telegram-miniapp/tests/goals.test.tsx`, `second-brain/backend/tests/test_goals_api.py` |
| FR-023 | Goal title/status/delete | `second-brain/telegram-miniapp/tests/goals.test.tsx` |
| FR-024 | Free active-goal limit | `second-brain/backend/tests/test_goals_api.py`, `test_premium_gating.py` |
| FR-025 | Active goals in dump parsing | `second-brain/backend/tests/test_today_top3.py`, `second-brain/backend/api/dump.py` |
| FR-026 | Today/backfill reflection form | `second-brain/telegram-miniapp/tests/reflection.test.tsx` |
| FR-027 | Daily summary endpoint and UI | `second-brain/backend/tests/test_reflections_api.py`, `second-brain/telegram-miniapp/tests/reflection.test.tsx` |
| FR-028 | Reflection history/detail/streak | `second-brain/telegram-miniapp/tests/reflection.test.tsx`, `second-brain/backend/tests/test_reflection_stats.py` |
| FR-029 | Reflection reminder settings UI/API | `second-brain/telegram-miniapp/tests/reflection.test.tsx`, `second-brain/backend/tests/test_telegram_reminders.py` |
| FR-030 | Bot reminder sender with Mini App deep links | `second-brain/backend/tests/test_telegram_reminders.py`, `second-brain/backend/services/reminder_scheduler.py` |
| FR-031 | Bot commands `/start`, `/help`, `/settings`, `/premium`, `/paysupport`, `/deleteaccount` | `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-032 | Bot text dump flow | `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-033 | Bot voice dump flow | `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-034 | Bot dump summary and Mini App button | `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-035 | Webhook secret validation | `second-brain/backend/tests/test_telegram_webhook.py` |
| FR-036 | Stars invoice endpoint and Premium screen | `second-brain/backend/tests/test_telegram_payments.py`, `second-brain/telegram-miniapp/tests/premium.test.tsx` |
| FR-037 | Successful Stars payment activates `user_premium` | `second-brain/backend/tests/test_telegram_payments.py` |
| FR-038 | Failed, duplicate, cancelled/closed, and refunded payment handling | `second-brain/backend/tests/test_telegram_payments.py`, `second-brain/telegram-miniapp/tests/premium.test.tsx` |
| FR-039 | RevenueCat/native mobile remains unchanged | `second-brain/mobile` typecheck and Jest suite |
| FR-040 | Missing premium rows fail safe to FREE | `second-brain/backend/tests/test_premium_api.py` |
| FR-041 | Profile metadata, stats, premium, memory, legal/support, language | `second-brain/telegram-miniapp/tests/profile.test.tsx` |
| FR-042 | Local Mini App sign out | `second-brain/telegram-miniapp/tests/profile.test.tsx` |
| FR-043 | Telegram account deletion confirmation | `second-brain/telegram-miniapp/tests/profile.test.tsx`, `second-brain/backend/tests/test_account_deletion.py` |
| FR-044 | Telegram cleanup/retention behavior | `second-brain/backend/tests/test_account_deletion.py`, `docs/runbooks/account-cleanup.md` |
| FR-045 | Legal docs updated for Telegram data | `docs/legal/privacy-policy.ru.md`, `docs/legal/privacy-policy.en.md` |
| FR-046 | Local Mini App/webhook/payment quickstart | `.specify/specs/006-telegram-miniapp/quickstart.md`, `docs/runbooks/telegram-miniapp.md`, `docs/runbooks/telegram-payments.md` |
| FR-047 | Production release checklist and rollback | `second-brain/RELEASE_CHECKLIST.md`, `docs/runbooks/telegram-miniapp.md` |
| FR-048 | Automated test coverage for auth, mapping, dumps, webhook, payments, reminders, cleanup | backend pytest, Mini App Vitest suites |
| FR-049 | Manual smoke-test path for Telegram iOS/Android/Desktop | `docs/runbooks/telegram-miniapp.md`; execution remains a release task |
| FR-050 | Observability tags/config without raw private dump logging | `second-brain/backend/api/telegram_webhook.py`, `second-brain/telegram-miniapp/src/services/sentry.ts`, `second-brain/backend/main.py` |

## Remaining Non-Code Evidence

- Cross-client Telegram iOS/Android/Desktop manual QA.
- Production BotFather, webhook, Railway, and frontend hosting configuration.
- Owner decisions/signoff for bot identity, price/support policy, linking policy, and bot dump scope.
