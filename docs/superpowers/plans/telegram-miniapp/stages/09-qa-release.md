# Stage 9 - QA And Release

## Objective

Prepare the Telegram Mini App and bot for production launch with testing, observability, deployment, BotFather configuration, and rollback procedures.

## Work To Do

- Add final frontend production build.
- Add backend routes to production app.
- Configure Sentry release for frontend and backend.
- Configure Telegram bot webhook.
- Configure BotFather:
  - Mini App URL.
  - menu button.
  - short description.
  - profile media/previews.
  - commands.
- Configure domain and HTTPS.
- Configure Railway variables.
- Configure frontend hosting variables.
- Run cross-client QA.
- Run payment QA in test environment.
- Run security QA.
- Write release/rollback runbook.
- Update release checklist.

## QA Matrix

### Telegram Clients

- Telegram iOS.
- Telegram Android.
- Telegram Desktop.
- External browser unsupported state.

### Viewports

- Small mobile.
- Large mobile.
- Desktop Telegram WebView.
- Full-screen mode.
- Compact mode if enabled.
- Keyboard open with textareas.

### Themes

- Telegram dark.
- Telegram light.
- Custom accent color.
- High contrast where available.

### Functional Smoke

- Open Mini App from `/start`.
- Complete onboarding.
- Submit text dump.
- Submit voice dump from Mini App or bot.
- Complete task.
- Create goal.
- Complete reflection.
- Receive reminder.
- Buy premium with Stars test flow.
- Delete account.

### Security

- Tampered `initData`.
- Replayed stale `initData`.
- Expired app session JWT.
- Invalid webhook secret.
- Payment payload mismatch.
- Cross-user resource access attempt.

## Files To Create Or Update

- `second-brain/RELEASE_CHECKLIST.md`
- `docs/runbooks/telegram-miniapp.md`
- `docs/runbooks/telegram-payments.md`
- `docs/store-listing/telegram-profile.md`
- `.github/workflows/telegram-miniapp-ci.yml` if separate CI is desired.

## Acceptance Criteria

- Backend tests pass.
- Telegram Mini App typecheck/tests/build pass.
- Manual QA matrix is complete.
- Bot webhook is configured and observable.
- Payment support command exists.
- Rollback path is documented.
- Production launch can happen without undocumented manual steps.
