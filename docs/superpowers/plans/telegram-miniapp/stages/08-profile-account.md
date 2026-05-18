# Stage 8 - Profile, Legal, Support, Account Lifecycle

## Objective

Finish the user account surface: profile, language, legal links, support, sign out, account deletion, and Telegram-specific cleanup.

## Screens

- Profile: `/profile`
- Support: `/support`
- Account pending deletion: `/account-pending-deletion`
- Legal links: external or embedded legal site.

## Work To Do

- Port profile screen.
- Show Telegram avatar/photo where available.
- Show Telegram username/provider badge.
- Show task stats.
- Show premium badge and expiry.
- Show AI memory preview.
- Add language switcher.
- Add reflection settings link.
- Add premium/paywall link.
- Add support and `/paysupport` instructions.
- Add legal links.
- Add local sign out/end session.
- Add account deletion confirmation.
- Add active subscription warning before deletion.
- Update cleanup cascade for Telegram-specific tables:
  - `telegram_accounts`.
  - `telegram_reminder_settings`.
  - `telegram_star_payments` according to retention policy.
- Update privacy policy to mention Telegram ID, username, and bot messages.
- Update runbooks for Telegram webhook, payments, and deletion.

## Backend Files

- `second-brain/backend/api/auth.py`
- `second-brain/backend/services/account_cleanup.py`
- `second-brain/backend/tests/test_account_deletion.py`
- `docs/legal/privacy-policy.ru.md`
- `docs/legal/privacy-policy.en.md`
- `docs/runbooks/account-cleanup.md`
- `docs/runbooks/telegram-miniapp.md`

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/profile/ProfileScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/support/SupportScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/account/AccountPendingDeletionScreen.tsx`
- `second-brain/telegram-miniapp/src/components/LanguageSwitcher.tsx`

## Tests

- Profile loads Telegram metadata.
- Premium status displays active/free states.
- Language switch changes UI and persists preference.
- Memory preview handles empty and error states.
- Sign out clears local session token and cached private data.
- Account deletion schedules deletion and redirects to pending/deleted state.
- Cleanup deletes Telegram account and reminder settings after grace period.
- Legal/support links are reachable.

## Acceptance Criteria

- User has a complete account-management surface in Telegram.
- Account deletion behavior matches mobile production-readiness behavior.
- Telegram-specific personal data is covered by privacy docs and cleanup.
- User can get payment support from bot and Mini App.
