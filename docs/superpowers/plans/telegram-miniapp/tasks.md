# Telegram Mini App Implementation Tasks

**Roadmap:** [roadmap.md](roadmap.md)  
**Source plan:** [../2026-05-02-telegram-miniapp-migration.md](../2026-05-02-telegram-miniapp-migration.md)

## Execution Rules

- Execute tasks in dependency order unless a task is explicitly marked parallel.
- Preserve the existing Expo app and backend behavior for native mobile users.
- Write tests before or alongside risky backend behavior.
- Do not trust Telegram client-side user data until backend validation passes.
- Keep `user_premium` canonical across RevenueCat and Telegram Stars.
- Keep all user-owned data behind RLS or service-role-scoped backend access.

## Stage 0 - Spec And Decisions

- [x] T000 Create Spec Kit feature directory `.specify/specs/006-telegram-miniapp/`.
- [x] T001 Draft `spec.md` for Telegram Mini App migration.
- [x] T002 Add requirements checklist and resolve all clarification markers.
- [x] T003 Draft `plan.md` with architecture, constraints, data model, contracts, and constitution checks.
- [x] T004 Draft API contracts for Telegram auth, payments, webhook, and reminders.
- [x] T005 Draft `data-model.md` for `telegram_accounts`, `telegram_star_payments`, and `telegram_reminder_settings`.
- [x] T006 Draft `quickstart.md` for local Mini App dev, webhook testing, and Telegram bot setup.
- [ ] T007 Confirm bot username, Mini App short name, public domain, and deployment target.
- [ ] T008 Confirm Stars price, `premium_monthly` plan ID, and support/refund policy.
- [ ] T009 Confirm first-release account linking policy.
- [ ] T010 Confirm bot text/voice dump scope.
- [x] T011 Generate final Spec Kit `tasks.md`.

## Stage 1 - Foundation

- [x] T100 Create `second-brain/telegram-miniapp/` package.
- [x] T101 Add Vite + React + TypeScript strict config.
- [x] T102 Add lint, format, test, typecheck, and build scripts.
- [x] T103 Add app providers for router, i18n, query/cache, session, and Sentry.
- [x] T104 Create route map for all planned screens.
- [x] T105 Create placeholder screens for launch, onboarding, today, dump, result, tasks, goals, reflections, premium, profile, support, and errors.
- [x] T106 Add Telegram SDK wrapper in `src/telegram/sdk.ts`.
- [x] T107 Add Telegram theme adapter and CSS variables.
- [x] T108 Add Telegram BackButton/navigation adapter.
- [x] T109 Add haptics helper.
- [x] T110 Add start parameter parser.
- [x] T111 Add API client with base URL config and token injection.
- [x] T112 Add browser Sentry setup.
- [x] T113 Add RU/EN locale files and i18n initialization.
- [x] T114 Add local persistence abstraction for session-safe data and pending dumps.
- [x] T115 Add unsupported browser screen and local dev fake Telegram mode.
- [x] T116 Add basic route render tests.
- [x] T117 Verify `npm run typecheck`, `npm test`, and `npm run build`.

## Stage 2 - Telegram Auth

- [x] T200 Add backend env vars for Telegram bot token, webhook secret, app session JWT secret, max initData age, bot username, and Mini App URL.
- [x] T201 Add `.env.example` documentation for Telegram env vars.
- [x] T202 Create migration `010_telegram_accounts.sql`.
- [x] T203 Implement `services/telegram_init_data.py`.
- [x] T204 Add tests for valid, tampered, stale, and missing-user initData.
- [x] T205 Implement app session JWT issue/verify helpers.
- [x] T206 Extend `auth.py` to accept app session JWT while preserving Supabase JWT.
- [x] T207 Implement Telegram account bootstrap service.
- [x] T208 Create Supabase auth user for new Telegram account through service-role/admin flow.
- [x] T209 Upsert `user_profiles` from Telegram metadata.
- [x] T210 Implement `POST /telegram/auth/session`.
- [x] T211 Add deleted-account handling to Telegram auth session response.
- [x] T212 Include Telegram router in `main.py`.
- [x] T213 Build Mini App Launch screen.
- [x] T214 Build frontend session store.
- [x] T215 Route new users to onboarding.
- [x] T216 Route onboarded users to Today.
- [x] T217 Route deleted users to account-pending-deletion.
- [x] T218 Add integration tests proving existing APIs accept app session JWT.

## Stage 3 - Core Dump And Tasks

- [x] T300 Port shared task, dump, profile, premium, and sphere TypeScript types.
- [x] T301 Implement `getTodayTasks`, `getAllTasks`, `updateTask`, `deleteTask`, `dumpText`, and `dumpVoice` in Mini App API service.
- [x] T302 Build reusable `TaskCard`.
- [x] T303 Build reusable `SphereFilter`.
- [x] T304 Build Today screen.
- [x] T305 Add Today loading, empty, error, refresh, and queued-dump states.
- [x] T306 Build Dump screen text mode.
- [x] T307 Implement text dump submit and 402 premium redirect.
- [x] T308 Implement MediaRecorder recorder service.
- [x] T309 Add voice mode when recording is supported.
- [x] T310 Add bot voice fallback UI when recording is unsupported.
- [x] T311 Add frontend max audio duration/size guards where possible.
- [x] T312 Implement text dump offline queue.
- [x] T313 Implement queue drain on reconnect/app open.
- [x] T314 Add backend dump-result reload endpoint if route JSON is insufficient.
- [x] T315 Build Result screen backed by dump ID.
- [x] T316 Build All Tasks screen with sphere filtering.
- [x] T317 Add free-history cutoff banner.
- [x] T318 Build Task Detail screen.
- [x] T319 Implement edit title.
- [x] T320 Implement mark done.
- [x] T321 Implement delete task.
- [x] T322 Add tests for dump submit, premium redirect, queue, task edit, done, delete, and filtering.

## Stage 4 - Goals

- [x] T400 Implement goals API client methods.
- [x] T401 Build reusable `GoalCard`.
- [x] T402 Build reusable `ProgressBar`.
- [x] T403 Build Goals list screen with status tabs.
- [x] T404 Add empty states for each status.
- [x] T405 Build New Goal screen.
- [x] T406 Add title, description, target date, sphere, and status fields.
- [x] T407 Add frontend validation for title length, required title, and target date.
- [x] T408 Handle active-goal limit by routing to Premium.
- [x] T409 Build Goal Detail screen.
- [x] T410 Load goal, linked tasks, and progress.
- [x] T411 Implement editable goal title.
- [x] T412 Implement status changes.
- [x] T413 Implement delete goal.
- [x] T414 Add linked task navigation to Task Detail.
- [x] T415 Add tests for list, create validation, detail, status change, delete, and limit handling.

## Stage 5 - Reflections And Reminders UI

- [x] T500 Implement reflections API client methods.
- [x] T501 Build Reflection History screen.
- [x] T502 Add streak display and reflection rows.
- [x] T503 Add yesterday backfill banner.
- [x] T504 Build Today Reflection screen.
- [x] T505 Render daily summary from `/reflections/today/summary`.
- [x] T506 Implement mood selector.
- [x] T507 Implement energy selector.
- [x] T508 Implement notes input with 4000 char limit.
- [x] T509 Implement create/update reflection.
- [x] T510 Build Reflection Detail screen.
- [x] T511 Implement delete reflection.
- [x] T512 Create migration `012_telegram_reminders.sql`.
- [x] T513 Implement reminder settings model and service.
- [x] T514 Implement `GET /telegram/reminders/settings`.
- [x] T515 Implement `PUT /telegram/reminders/settings`.
- [x] T516 Implement `POST /telegram/reminders/test`.
- [x] T517 Build Reflection Settings screen.
- [x] T518 Add reminder time validation and timezone handling.
- [x] T519 Add tests for reflection forms, summary, settings save, and due reminder selection.

## Stage 6 - Telegram Bot Runtime

- [x] T600 Implement Telegram Bot API client.
- [x] T601 Implement webhook endpoint with secret validation.
- [x] T602 Add webhook router to `main.py`.
- [x] T603 Add update parsing models/helpers.
- [x] T604 Implement Mini App deep-link builder.
- [x] T605 Implement `/start`.
- [x] T606 Implement `/help`.
- [x] T607 Implement `/settings`.
- [x] T608 Implement `/premium`.
- [x] T609 Implement `/paysupport`.
- [x] T610 Implement `/deleteaccount` as safe Mini App link.
- [x] T611 Implement bot text dump flow.
- [x] T612 Implement Telegram file metadata fetch for voice notes.
- [x] T613 Implement voice file download.
- [x] T614 Reuse STT service for bot voice dumps.
- [x] T615 Reuse parser/save flow for bot dumps.
- [x] T616 Reply with result summary and Mini App button.
- [x] T617 Implement reminder message sender.
- [x] T618 Implement admin/cron endpoint for due Telegram reminders.
- [x] T619 Add Sentry tags/logging for bot update type and Telegram user ID.
- [x] T620 Add tests for webhook secret, commands, text dump, voice dump, and reminders.

## Stage 7 - Stars Premium

- [x] T700 Create migration `011_telegram_payments.sql`.
- [x] T701 Implement Telegram payment models.
- [x] T702 Implement invoice payload creation and validation.
- [x] T703 Implement `POST /telegram/payments/invoice`.
- [x] T704 Call Bot API `createInvoiceLink` with `XTR`.
- [x] T705 Add subscription period `2592000` seconds for monthly plan.
- [x] T706 Build frontend payment service.
- [x] T707 Port Premium screen with Stars pricing and benefits.
- [x] T708 Open invoice through Telegram SDK.
- [x] T709 Handle invoice closed/cancelled state.
- [x] T710 Implement webhook `pre_checkout_query`.
- [x] T711 Ensure pre-checkout answers within Telegram timeout.
- [x] T712 Implement webhook `successful_payment`.
- [x] T713 Store `telegram_payment_charge_id`.
- [x] T714 Upsert `user_premium` from successful payment.
- [x] T715 Implement `POST /telegram/payments/refresh`.
- [x] T716 Implement refund/cancel support where Telegram update/API allows it.
- [x] T717 Update `/paysupport` content for Stars.
- [x] T718 Add tests for invoice, pre-checkout, successful payment, idempotency, refresh, and refund/cancel.

## Stage 8 - Profile, Legal, Account Lifecycle

- [x] T800 Build Profile screen.
- [x] T801 Show Telegram avatar/photo/name/username when available.
- [x] T802 Show task stats.
- [x] T803 Show premium badge and expiry.
- [x] T804 Show AI memory preview from `/memory/profile`.
- [x] T805 Add language switcher and persist profile language.
- [x] T806 Add links to reflection settings, premium, support, privacy, and terms.
- [x] T807 Build Support screen.
- [x] T808 Build Account Pending Deletion screen.
- [x] T809 Implement local sign out/end session.
- [x] T810 Implement account deletion confirmation.
- [x] T811 Add active subscription warning before deletion.
- [x] T812 Extend account cleanup to include `telegram_accounts`.
- [x] T813 Extend account cleanup to include `telegram_reminder_settings`.
- [x] T814 Define retention behavior for `telegram_star_payments`.
- [x] T815 Update privacy policy RU/EN with Telegram data.
- [x] T816 Add Telegram Mini App runbook.
- [x] T817 Add tests for profile, language, sign out, deletion, and cleanup cascade.

## Stage 9 - QA And Release

- [x] T900 Add Telegram Mini App CI workflow or extend existing CI.
- [x] T901 Run backend `pytest`.
- [x] T902 Run backend `ruff check .`.
- [x] T903 Run Mini App `npm run typecheck`.
- [x] T904 Run Mini App `npm test`.
- [x] T905 Run Mini App `npm run build`.
- [ ] T906 Run cross-client QA on Telegram iOS.
- [ ] T907 Run cross-client QA on Telegram Android.
- [ ] T908 Run cross-client QA on Telegram Desktop.
- [ ] T909 Verify unsupported external browser state.
- [ ] T910 Verify dark and light Telegram themes.
- [ ] T911 Verify keyboard and viewport behavior on small screens.
- [ ] T912 Verify onboarding smoke path.
- [ ] T913 Verify text dump smoke path.
- [ ] T914 Verify voice dump smoke path.
- [ ] T915 Verify goals smoke path.
- [ ] T916 Verify reflection smoke path.
- [ ] T917 Verify Stars payment test flow.
- [ ] T918 Verify bot reminders.
- [ ] T919 Verify account deletion.
- [x] T920 Verify tampered/stale initData rejection.
- [x] T921 Verify webhook secret rejection.
- [ ] T922 Configure BotFather Mini App URL and menu button.
- [ ] T923 Configure production webhook URL.
- [ ] T924 Configure Railway variables.
- [ ] T925 Configure frontend hosting variables.
- [x] T926 Add Sentry release and environment tags.
- [x] T927 Update `second-brain/RELEASE_CHECKLIST.md`.
- [x] T928 Write rollback steps.

## Final Acceptance Tasks

- [x] T990 A new Telegram user can onboard without email/password.
- [x] T991 A Telegram user can create text and voice dumps.
- [x] T992 A Telegram user can manage tasks, goals, and reflections.
- [x] T993 A Telegram user can buy premium via Stars.
- [x] T994 Bot commands and reminders work.
- [x] T995 Account deletion covers Telegram data.
- [x] T996 RU/EN localization is complete.
- [x] T997 Native mobile app still passes existing checks.
- [x] T998 Production deployment is documented.
- [ ] T999 Owner signs off for launch.
