# AI Life OS Roadmap

**Source docs:** `logic.md`, `center-upravlenia.md`, `tasks-source.md`, `health.md`, `finance.md`, `avto.md`  
**Implementation target:** Telegram Mini App first, with backend and AI services designed so mobile can reuse the same contracts later.

## Summary

AI Life OS is the next product layer for Second Brain: a personal operating system that connects goals, tasks, health, finance, autonomy, integrations, and long-term AI memory. The user interacts through chat, voice, photos, dashboards, and proactive recommendations. The system must stay user-controlled: AI can suggest, prepare, and automate, but high-risk actions require explicit confirmation and every autonomous action is logged.

This roadmap replaces the old Telegram migration documentation. The implementation source of truth is this folder.

## Roadmap Index

| Stage | Goal | Detail | Exit Criteria |
| --- | --- | --- | --- |
| 00 | Product scope | [00-product-scope.md](stages/00-product-scope.md) | Life OS boundaries, first-release modules, and success criteria are explicit |
| 01 | Foundation | [01-foundation.md](stages/01-foundation.md) | Shared domain model, navigation, contracts, privacy defaults, and AI budget rules are ready |
| 02 | Control Center | [02-control-center.md](stages/02-control-center.md) | Dashboard, OKR, KPI, reviews, briefing, and energy-aware planning are usable |
| 03 | Tasks | [03-tasks.md](stages/03-tasks.md) | Capture, inbox, priority, planning, focus, projects, recurring tasks, tags, and analytics work |
| 04 | Health | [04-health.md](stages/04-health.md) | Health dashboard, sleep, activity, workouts, nutrition, HRV, stress, labs, meds, and insights work |
| 05 | Finance | [05-finance.md](stages/05-finance.md) | Finance dashboard, transactions, budgets, goals, subscriptions, debts, assets, net worth, income, taxes, and AI finance chat work |
| 06 | Autonomy | [06-autonomy.md](stages/06-autonomy.md) | Triggers, routines, agents, permissions, audit log, proactive actions, and anomaly detection work |
| 07 | Integrations | [07-integrations.md](stages/07-integrations.md) | Calendar, Telegram/bot input, wearable imports, finance imports, OCR, and manual fallbacks are planned |
| 08 | AI Memory | [08-ai-memory.md](stages/08-ai-memory.md) | Long-term profile, baseline, preferences, RAG, personalization, and feedback loop work |
| 09 | UI Delivery | [09-ui-delivery.md](stages/09-ui-delivery.md) | Telegram Mini App routes, states, mobile WebView behavior, and localization are ready |
| 10 | QA Release | [10-qa-release.md](stages/10-qa-release.md) | Tests, builds, manual QA, security/privacy review, and owner sign-off are complete |

## Dependency Order

1. Stage 00 locks scope and non-negotiable product rules.
2. Stage 01 builds shared primitives used by all modules.
3. Stages 02-05 can be implemented in product slices after foundation, but Control Center must define the dashboard contracts first.
4. Stages 06-08 must reuse data produced by Tasks, Health, Finance, and Control Center.
5. Stage 09 turns module capability into the Telegram Mini App user experience.
6. Stage 10 verifies the whole system and keeps manual QA open until real devices are checked.

## Non-Negotiables

- AI calls go through `second-brain/backend/services/ai_router.py` with per-user budget gating.
- Premium gating fails safe to FREE when premium state is missing or unclear.
- User-owned data requires RLS or backend service-role access with explicit ownership checks.
- Telegram `initDataUnsafe` is never a trusted identity source.
- Health and finance recommendations must be framed as assistant guidance, not medical, legal, tax, or investment advice.
- Autonomous actions have permission levels: suggest only, confirm before action, or allowed automation.
- Raw private user content must not be written to logs or analytics.

## Validation

Use [fr-coverage.md](fr-coverage.md) as the coverage matrix. Every requirement from the source docs must map to a stage and one or more implementation tasks in [tasks.md](tasks.md).
