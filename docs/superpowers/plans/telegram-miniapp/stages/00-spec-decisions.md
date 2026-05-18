# Stage 0 - Spec And Decisions

## Objective

Turn the Telegram Mini App migration into a formal feature with clear product decisions before implementation starts.

## Work To Do

- Create Spec Kit feature `006-telegram-miniapp`.
- Write `spec.md` from user value, not implementation details.
- Write `plan.md` with architecture, constitution checks, data model, contracts, and quickstart.
- Generate `tasks.md` from the finalized design.
- Confirm bot username and Mini App display name.
- Confirm public domain for the Mini App.
- Confirm deployment target for the static web client.
- Confirm deployment target for the backend webhook.
- Decide the first-release payment model:
  - Telegram Stars monthly subscription.
  - Plan ID: `premium_monthly`.
  - Internal entitlement maps to existing `user_premium`.
- Decide account linking policy.
  - Recommended first release: no linking between existing mobile accounts and Telegram accounts.
  - Later release: secure link code flow from mobile profile to Telegram.
- Decide bot input scope.
  - Recommended first release: include bot text and voice dumps.
- Decide supported languages.
  - Required: RU and EN.
- Decide supported Telegram clients for QA.
  - Required: iOS, Android, Desktop.

## Files To Create Or Update

- `.specify/specs/006-telegram-miniapp/spec.md`
- `.specify/specs/006-telegram-miniapp/plan.md`
- `.specify/specs/006-telegram-miniapp/tasks.md`
- `.specify/specs/006-telegram-miniapp/contracts/`
- `.specify/specs/006-telegram-miniapp/data-model.md`
- `.specify/specs/006-telegram-miniapp/quickstart.md`
- `AGENTS.md` if the current plan pointer should move from production-readiness to Telegram work.

## Decisions To Record

- Bot username.
- Mini App short name.
- Mini App route mode: full-screen by default.
- Stars price.
- Whether private beta uses test bot or production bot.
- Whether Mini App can be opened outside Telegram in read-only/dev mode.
- Whether voice recording in WebView is required or bot voice fallback is enough for alpha.

## Risks

- Starting implementation before auth/payment decisions causes expensive rewrites.
- Account linking can become a privacy and support problem if added casually.
- Stars pricing cannot be treated as a direct `$4.99` clone without product review.

## Acceptance Criteria

- Spec Kit feature exists and passes checklist.
- All open decisions have an owner and default.
- Roadmap and tasks are linked from the feature docs.
- Implementation can begin without asking architecture-level questions.
