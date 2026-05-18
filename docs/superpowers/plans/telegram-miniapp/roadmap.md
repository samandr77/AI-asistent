# Telegram Mini App Roadmap

**Product:** Second Brain  
**Created:** 2026-05-02  
**Source plan:** [2026-05-02-telegram-miniapp-migration.md](../2026-05-02-telegram-miniapp-migration.md)  
**Implementation tasks:** [tasks.md](tasks.md)  
**Functional coverage:** [fr-coverage.md](fr-coverage.md)

## Direction

Build Telegram Mini App as a second frontend, not as a replacement for the Expo app. The existing FastAPI backend and Supabase database remain the system of record. The Telegram version adds Telegram identity, bot entrypoints, bot reminders, Stars payments, and a web UI optimized for Telegram WebView.

## Milestone Map

| Stage | Goal | Detailed Plan | Exit Gate |
| --- | --- | --- | --- |
| 0 | Fix scope, product decisions, and Spec Kit artifacts | [00-spec-decisions.md](stages/00-spec-decisions.md) | `006-telegram-miniapp` spec is ready and decisions are recorded |
| 1 | Create web Mini App foundation | [01-foundation.md](stages/01-foundation.md) | Web client builds, routes exist, Telegram SDK wrapper works |
| 2 | Add Telegram auth and app sessions | [02-telegram-auth.md](stages/02-telegram-auth.md) | Mini App opens from Telegram and authenticates without email/password |
| 3 | Port core dump and task flows | [03-core-dump-tasks.md](stages/03-core-dump-tasks.md) | User can submit dumps and manage tasks in Telegram |
| 4 | Port goals | [04-goals.md](stages/04-goals.md) | Goals list/create/detail/progress work with existing backend rules |
| 5 | Port reflections and reminder settings | [05-reflections-reminders.md](stages/05-reflections-reminders.md) | Daily reflection and reminder preferences work in web UI |
| 6 | Add Telegram bot runtime | [06-bot-runtime.md](stages/06-bot-runtime.md) | Bot handles commands, text dumps, voice dumps, and deep links |
| 7 | Add Stars premium | [07-stars-premium.md](stages/07-stars-premium.md) | Premium can be purchased in Telegram through Stars |
| 8 | Finish profile, legal, account lifecycle | [08-profile-account.md](stages/08-profile-account.md) | Profile, language, support, legal, sign out, and deletion are complete |
| 9 | QA, observability, and release | [09-qa-release.md](stages/09-qa-release.md) | Cross-client Telegram QA passes and production launch is configured |

## Delivery Order

1. **Foundation path:** stages 0 -> 1 -> 2. Nothing meaningful can ship before Telegram auth and the Mini App shell exist.
2. **Core product path:** stages 3 -> 4 -> 5. These preserve the current daily-use value: capture, tasks, goals, reflection.
3. **Telegram-native path:** stages 6 -> 7. These turn the web client into a real Telegram product with bot input and Stars.
4. **Production path:** stages 8 -> 9. These close privacy, support, deletion, analytics, and launch readiness.

## Main Dependencies

- Stage 2 depends on Stage 1 and blocks all authenticated product screens.
- Stage 3 depends on Stage 2 because `/dump/*` and `/tasks/*` require an app session token.
- Stage 5 reminder delivery depends on Stage 6 bot messaging, but the reminder settings UI can be built earlier.
- Stage 7 depends on Stage 6 webhook handling because payments arrive as bot updates.
- Stage 8 account cleanup depends on migrations from Stage 2 and Stage 7.
- Stage 9 depends on every previous stage.

## Product Completeness Checklist

- All current app tabs exist in Telegram: Today, All Tasks, Goals, Profile.
- Hidden/detail flows exist: Dump, Result, Task Detail, New Goal, Goal Detail, Reflections, Premium, Account Deletion.
- Telegram-only flows exist: Launch/Auth, Bot Support, Bot Text Dump, Bot Voice Dump, Stars Payment, Reminder Deep Links.
- Free/premium policy is identical across mobile and Telegram.
- Native-only features are replaced, not silently dropped:
  - RevenueCat -> Telegram Stars.
  - Expo notifications -> bot reminders.
  - Expo audio -> MediaRecorder plus bot voice-note fallback.
  - Supabase OAuth -> Telegram `initData`.

## Release Milestones

### Internal Alpha

Scope: stages 0-3.

Users can open the Mini App, authenticate through Telegram, complete onboarding, submit text dumps, and manage tasks. Voice can still be text-only or fallback-only.

### Private Beta

Scope: stages 0-6.

The product is useful inside Telegram: bot commands work, bot text/voice dumps work, goals and reflections work, reminders can be configured.

### Monetized Beta

Scope: stages 0-8.

Stars premium works, profile/account lifecycle is complete, legal/support flows are visible, and data deletion covers Telegram-specific rows.

### Production Launch

Scope: stages 0-9.

Production bot, Mini App URL, webhook, domain, monitoring, QA, and rollback procedures are ready.
