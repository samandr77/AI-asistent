# Runbook: Telegram Mini App

## Purpose

Operate the Telegram web frontend, bot webhook, reminders, and Stars payments
without affecting the existing native mobile app.

## Required Variables

Backend Railway variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_MINIAPP_URL`
- `APP_SESSION_JWT_SECRET`
- `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`
- `TELEGRAM_PREMIUM_MONTHLY_STARS`
- `ADMIN_CLEANUP_SECRET`

Frontend hosting variable:

- `VITE_API_URL`

## Bot Token

Create a normal Telegram bot through `@BotFather`:

1. Open Telegram and start a chat with the verified `@BotFather`.
2. Send `/newbot`.
3. Choose a display name.
4. Choose a username ending in `bot`, for example `SecondBrainDevBot`.
5. Copy the token BotFather returns into `TELEGRAM_BOT_TOKEN`.
6. Put the bot username without `@` into `TELEGRAM_BOT_USERNAME`.

If the token is exposed, revoke it in BotFather and update every environment
that used the old token.

## Local Docker Run

Use this when Railway/frontend hosting is not configured yet.

1. Prepare env:

```bash
cp .env.telegram-local.example .env.telegram-local
```

2. Fill at least:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_SECRET`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` if testing real bot/webhook flows

3. Apply Supabase migrations `010` through `013`.

4. Start containers:

```bash
docker compose --env-file .env.telegram-local -f docker-compose.telegram-local.yml up --build
```

5. Open:

- Mini App browser/dev mode: `http://localhost:5174`
- Backend health: `http://localhost:8000/health`

The local browser flow uses `TELEGRAM_DEV_AUTH_ENABLED=true` and
`VITE_TELEGRAM_DEV_MODE=1`. Keep both disabled outside local development.

### Testing Real Telegram Locally

The main Telegram environment requires public HTTPS URLs for Mini Apps and
webhooks. Use a tunnel such as ngrok or Cloudflare Tunnel:

1. Expose backend `localhost:8000` as `https://<api-tunnel>`.
2. Expose Mini App `localhost:5174` as `https://<app-tunnel>`.
3. Set `VITE_API_URL=https://<api-tunnel>` and
   `TELEGRAM_MINIAPP_URL=https://<app-tunnel>` in `.env.telegram-local`.
4. Restart Docker compose.
5. Configure BotFather Mini App URL to `https://<app-tunnel>`.
6. Configure webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<api-tunnel>/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Deploy Order

1. Apply Supabase migrations `010` through `013`.
2. Deploy backend with Telegram variables.
3. Build and deploy `second-brain/telegram-miniapp`.
4. Configure BotFather Mini App URL to `TELEGRAM_MINIAPP_URL`.
5. Configure webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$BACKEND_URL/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Smoke Checks

- Open Mini App from Telegram and verify `/telegram/auth/session`.
- Submit a text dump in Mini App.
- Send `/start`, `/help`, `/settings`, `/premium`, and a text dump to the bot.
- Send a voice note to the bot.
- Save reminder settings and trigger due reminders:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_CLEANUP_SECRET" \
  "$BACKEND_URL/telegram/reminders/send-due"
```

- Start a Telegram Stars invoice from Premium and confirm `/premium/status`.

## Cross-Client QA Matrix

Record real-device results before public launch.

| Client | Theme | Launch/Auth | Text Dump | Voice Dump | Goals | Reflection | Stars | Reminders | Account Deletion | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Telegram iOS | Light/Dark | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Pending |
| Telegram Android | Light/Dark | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Pending |
| Telegram Desktop | Light/Dark | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Pending |

Automated evidence currently covers auth validation, app session JWTs,
webhook secrets, bot commands, bot text/voice dump flow, Stars invoice and
payment activation, reminder selection/sending, account cleanup coverage,
Mini App screen flows, native mobile typecheck, and native mobile Jest tests.

## Rollback

1. Disable the bot menu button or point BotFather Mini App URL to a maintenance page.
2. Delete the Telegram webhook with `deleteWebhook`.
3. Keep backend migrations in place; they are backward-compatible with native mobile.
4. Redeploy the previous Mini App static build if only frontend is affected.

## Failure Modes

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Mini App login fails | invalid `APP_SESSION_JWT_SECRET` or stale `initData` | Check backend logs and Telegram auth tests |
| Webhook returns 401 | secret mismatch | Compare BotFather/setWebhook secret with Railway |
| Stars checkout fails | bot token, amount, or invoice payload mismatch | Check `telegram_star_payments` row and Bot API response |
| Reminder endpoint returns 401 | admin bearer missing | Use `ADMIN_CLEANUP_SECRET` |
| Premium not active after payment | successful payment webhook not received | Inspect Telegram webhook logs and `/telegram/payments/refresh` |
