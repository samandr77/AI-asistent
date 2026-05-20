# Stage 01 - Foundation

## Goal

Build the shared technical base for all Life OS modules: domains, navigation, data contracts, privacy defaults, budget-gated AI calls, and auditability.

## Backend

- Add user-owned domain settings and KPI definitions.
- Add recommendation, feedback, permission, and audit event records.
- Add API contracts for dashboard summary, domain setup, AI feedback, and audit history.
- Enforce RLS or backend ownership checks for every new table.
- Redact raw health, finance, task, document, and message content from logs.

## Frontend

- Add Telegram Mini App route groups for Control Center, Tasks, Health, Finance, Autonomy, Integrations, AI Memory, Profile, Settings.
- Add shared types for domains, metrics, recommendations, permission levels, and audit records.
- Add reusable empty/loading/error/offline/premium-needed states.

## AI

- Route all AI calls through `services/ai_router.py`.
- Add module names and budget attribution.
- Store AI output with confidence, source references, and feedback state.

## Acceptance Criteria

- Shared models support all later module stages without one-off schemas.
- Tests cover auth, RLS, premium fallback, AI budget gating, and log redaction.
