# Stage 10 - QA And Release

## Goal

Verify the new Life OS plan and implementation path before release.

## Automated Checks

- Backend tests: `cd second-brain/backend && pytest`.
- Backend lint: `cd second-brain/backend && ruff check .`.
- Telegram Mini App typecheck: `cd second-brain/telegram-miniapp && npm run typecheck`.
- Telegram Mini App tests: `cd second-brain/telegram-miniapp && npm test`.
- Telegram Mini App build: `cd second-brain/telegram-miniapp && npm run build`.
- Stale docs check: search `AGENTS.md`, `docs`, and `.specify` for the removed old feature id and removed old roadmap path; both searches must return no stale plan references.

## Manual QA

- Telegram iOS smoke.
- Telegram Android smoke.
- Telegram Desktop smoke.
- Dark and light theme.
- Small viewport and keyboard behavior.
- Offline/reconnect behavior.
- Premium/free states.
- Health and finance safety wording.
- Autonomy permission and audit behavior.

## Release Criteria

- `fr-coverage.md` has no unmapped source requirements.
- All stage tasks needed for release are complete.
- Manual external-provider setup remains open unless actually verified.
- Owner signs off on product scope and launch readiness.
