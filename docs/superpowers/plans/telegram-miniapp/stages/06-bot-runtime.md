# Stage 6 - Telegram Bot Runtime

## Objective

Make the product feel native to Telegram by adding bot commands, text/voice dump intake, deep links, and reminder message delivery.

## Work To Do

- Add Telegram Bot API client.
- Add webhook endpoint with secret validation.
- Configure webhook URL.
- Implement commands:
  - `/start`
  - `/help`
  - `/settings`
  - `/premium`
  - `/paysupport`
  - `/deleteaccount`
- Implement bot text dumps.
- Implement bot voice dumps:
  - receive voice message.
  - fetch file path from Telegram.
  - download audio bytes.
  - pass through existing STT fallback.
  - parse tasks.
  - reply with result summary and Mini App deep link.
- Implement reminder sender:
  - evening reflection.
  - morning planning.
  - task reminders if server-side task reminders are included.
- Add deep-link buttons to relevant screens.
- Add structured logging and Sentry tags for bot updates.

## Backend Files

- `second-brain/backend/api/telegram_webhook.py`
- `second-brain/backend/services/telegram_bot.py`
- `second-brain/backend/services/telegram_updates.py`
- `second-brain/backend/services/telegram_deeplinks.py`
- `second-brain/backend/services/reminder_scheduler.py`
- `second-brain/backend/tests/test_telegram_webhook.py`
- `second-brain/backend/tests/test_telegram_bot_dumps.py`
- `second-brain/backend/tests/test_telegram_reminders.py`

## Bot Command Behavior

- `/start`: welcome, explain core value, button "Open Second Brain".
- `/help`: explain text dump, voice dump, reminders, premium, support.
- `/settings`: link to Mini App reminder/profile settings.
- `/premium`: link to Mini App paywall.
- `/paysupport`: tell user how to report Stars payment issue and record support intent if needed.
- `/deleteaccount`: link to profile deletion screen; do not delete directly from plain command.

## Bot Text Dump Flow

1. User sends a normal text message to the bot.
2. Backend validates/matches Telegram account.
3. Backend reuses existing `parse_dump` pipeline.
4. Backend saves dump and tasks.
5. Bot replies with:
   - number of tasks created.
   - top 3 today if available.
   - button opening `/result/:dumpId`.

## Bot Voice Dump Flow

1. User sends voice note.
2. Backend downloads file using Bot API.
3. Backend enforces max size/duration.
4. Backend transcribes through existing STT service.
5. Backend parses and saves tasks.
6. Bot replies with transcription preview and Mini App result link.

## Tests

- Webhook rejects missing/invalid secret.
- `/start` returns Mini App button.
- `/paysupport` returns support instructions.
- Text message creates dump.
- Voice message calls file download and STT pipeline.
- Unknown Telegram user is bootstrapped or invited to open Mini App.
- Reminder sender sends only due reminders.
- Bot deep links contain correct `startapp` params.

## Acceptance Criteria

- User can use Second Brain from chat without opening the Mini App first for every dump.
- Voice fallback is reliable even when WebView recording is unavailable.
- Reminder messages open the correct Mini App screen.
- Payment support command exists before Stars launch.
