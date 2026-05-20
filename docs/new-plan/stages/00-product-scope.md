# Stage 00 - Product Scope

## Goal

Turn the raw `docs/new-plan` descriptions into one coherent AI Life OS product scope. This stage defines what the first complete release must include, which surfaces are supported, and which safety boundaries cannot be crossed.

## Inputs

- `logic.md`: overall AI assistant concept, onboarding, integrations, baseline, privacy, OKR, multimodal input.
- `center-upravlenia.md`: dashboard, OKR, strategic planning, KPI, reviews, energy, knowledge base, automations.
- `tasks-source.md`: task management, GTD, inbox, planning, focus, projects, habits, analytics.
- `health.md`: health score, sleep, activity, nutrition, biomarkers, stress, medical data.
- `finance.md`: finance dashboard, transactions, budgets, goals, subscriptions, debts, assets, net worth, taxes.
- `avto.md`: autonomy, agents, routines, triggers, reporting, permissions.

## Implementation Decisions

- First surface: Telegram Mini App.
- Backend contracts must be reusable by native mobile.
- All modules share one life-domain model and one AI memory layer.
- Health and finance advice is assistant guidance, not professional advice.
- Autonomous actions default to confirmation unless a user explicitly allowed the scenario.

## Acceptance Criteria

- Every source document is mapped in `fr-coverage.md`.
- Every first-release capability has a stage and task range.
- Out-of-scope capabilities are explicit rather than silently omitted.
- Safety rules for autonomy, finance, health, tax, and investments are documented.
