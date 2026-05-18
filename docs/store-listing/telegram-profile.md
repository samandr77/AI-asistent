# Telegram Bot Profile Checklist

## BotFather

- Bot name: `Second Brain`
- Username: confirm final production handle before launch.
- Description: `Voice/text dumps into structured tasks, goals, and evening reflections.`
- About: `Personal AI assistant for planning your day from Telegram.`
- Commands:
  - `start` — Open Second Brain
  - `help` — How to use dumps, reminders, Premium, support
  - `settings` — Open reminder and profile settings
  - `premium` — Open Telegram Stars Premium
  - `paysupport` — Payment support
  - `deleteaccount` — Account deletion
- Menu button: Web App → production `TELEGRAM_MINIAPP_URL`.

## Assets

- Bot avatar: 640x640 PNG, readable at 48x48.
- Mini App icon: matches bot avatar and native app icon family.
- Short name: confirm in BotFather for Mini App launch surface.
- Screenshots for internal docs: launch, dump, today, goals, reflection, premium, profile.

## Pre-Launch Checks

- Webhook URL configured with secret.
- `/start` opens Mini App button.
- `/paysupport` points users to support.
- Stars test invoice succeeds.
- Privacy and terms URLs are visible from Profile and Support.
