# RevenueCat + Paywall setup

Step-by-step activation of the premium subscription flow: App Store Connect →
Google Play Console → RevenueCat → Supabase → EAS → Mobile env. Last step in the
Spec-Kit 004-paywall-premium flow, paired with
[oauth-setup.md](oauth-setup.md).

## 1. App Store Connect (iOS)

1. **Create subscription product**
   - App Store Connect → My Apps → Second Brain → Subscriptions → create a
     **Subscription Group** called `Premium`.
   - Inside the group add two products:
     - `premium_monthly` — Auto-Renewable, Monthly, $4.99 (or your tier 1 price)
     - `premium_yearly` — Auto-Renewable, Yearly, $39.99 (annual discount)
   - Set display name, review info and localized descriptions in EN + RU.
2. **StoreKit configuration**
   - Paid Apps Agreement must be signed and active (Agreements, Tax, and Banking).
   - Generate an **App Store Connect API key** (Users and Access → Keys):
     Role = Admin. Save the `.p8` file, Issuer ID, and Key ID — RevenueCat needs
     all three to validate receipts.
3. **Sandbox testers**
   - Users and Access → Sandbox Testers → add at least one sandbox Apple ID.
   - Sign out of any real Apple ID on the device before TestFlight / sandbox
     purchases.

## 2. Google Play Console (Android)

1. **Create subscription**
   - Play Console → Second Brain → Monetize → Subscriptions → Create subscription.
   - Product ID must match the iOS identifier conventions — use
     `premium_monthly` and `premium_yearly` so the RevenueCat dashboard treats
     them as the same entitlement across stores.
2. **Service account**
   - Google Cloud Console → IAM → Service Accounts → create one with role
     **Pub/Sub Publisher** (for RC's Real-Time Developer Notifications).
   - In Play Console → Setup → API access, link the service account and grant
     Financial Reports + Subscriptions view access.
   - Download the JSON key; RevenueCat will consume it.
3. **License test accounts**
   - Play Console → Setup → License testing → add your test Google account.
   - These accounts can purchase without being charged.

## 3. RevenueCat Dashboard

1. **Projects & Apps**
   - Create project "Second Brain".
   - Add iOS app: bundle ID = `com.secondbrain.app`, upload App Store Connect
     API key triple.
   - Add Android app: package = `com.secondbrain.app`, upload Play Console
     service account JSON.
2. **Entitlement**
   - Create one entitlement called `premium`. Attach both products to it.
3. **Offering**
   - Create the default offering named `default`. Add both packages:
     - `$rc_monthly` → `premium_monthly`
     - `$rc_annual` → `premium_yearly`
   - Mark the annual package as the featured option.
4. **Webhook**
   - RevenueCat Dashboard → Integrations → Webhooks → add endpoint:
     `https://<your-railway-backend>/webhooks/revenuecat`.
   - Auth header: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`. Save the
     secret — it must match the backend env var (see §5).
5. **API keys (public SDK keys)**
   - Project Settings → API Keys → copy the iOS and Android public SDK keys —
     these are the values placed into EAS secrets + `.env`.

## 4. Supabase

```bash
cd second-brain/supabase/migrations
# Already created by the paywall spec:
# 007_premium.sql — creates user_premium table + RLS + triggers
```

Apply `007_premium.sql` in your Supabase SQL editor before the first webhook
arrives. The table has RLS: clients can `SELECT` their own row but only the
service role can write. The backend writes via the RevenueCat webhook.

## 5. Backend env (Railway)

Set the following in **Railway Variables** for the backend service:

| Key                            | Value                                  |
| ------------------------------ | -------------------------------------- |
| `REVENUECAT_WEBHOOK_SECRET`    | same Bearer token as set in RC webhook |
| `DAILY_FREE_TOKEN_BUDGET`      | `50000` (default)                      |
| `DAILY_PREMIUM_TOKEN_BUDGET`   | `500000`                               |
| `FREE_DAILY_DUMP_LIMIT`        | `10`                                   |
| `FREE_MAX_ACTIVE_GOALS`        | `3`                                    |
| `FREE_HISTORY_DAYS`            | `30`                                   |

`REVENUECAT_WEBHOOK_SECRET` has **no default** — the app fails to start if it's
missing. This is intentional: a deploy without the secret would silently accept
unsigned webhooks.

## 6. Mobile env (EAS secrets)

```bash
cd second-brain/mobile
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "appl_..."
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "goog_..."
```

Also mirror the keys into `mobile/.env` (local development) — `.env.example`
already documents them.

## 7. Testing

### Sandbox (iOS)

1. Build with `npm run preview:ios` or `eas build --profile development`.
2. Install on device, sign in with a **Sandbox Tester** account.
3. Launch the paywall, pick Monthly → purchase prompt appears with
   "[Environment: Sandbox]".
4. After purchase the backend should receive an `INITIAL_PURCHASE` webhook.
   Verify via Railway logs or:
   ```bash
   curl -H "Authorization: Bearer <supabase_jwt>" https://<backend>/premium/status
   ```
   Expected: `{"is_premium": true, "expires_at": "..."}`.

### License test (Android)

1. Build with `npm run preview:android`.
2. Install the `.apk`/`.aab` on a device signed in with a license test account.
3. Purchase flow works without real charge.
4. Same verification via `/premium/status`.

### Simulating cancellations

On RevenueCat dashboard → Customers → pick the user → Grant / Revoke
entitlement. Backend webhook will arrive as `CANCELLATION` (is_premium stays
true until `EXPIRATION`).

## 8. Rebuild EAS after env changes

After editing `app.json` plugins or adding EAS secrets, **always rebuild** — OTA
updates do not pick up native config changes:

```bash
cd second-brain/mobile
eas build --profile preview --platform all
```

## 9. Troubleshooting

- **"No offerings available"** — your RevenueCat offering is empty or named
  something other than `default`. Check the dashboard and rebuild the app so the
  SDK picks up the new config.
- **Webhook returns 401** — `REVENUECAT_WEBHOOK_SECRET` env differs from the
  dashboard value. Tokens are compared via `hmac.compare_digest` (constant time).
- **Client reports premium but `/premium/status` returns free** — the webhook
  never fired (check RC dashboard → Integrations → Webhooks → Delivery Log) or
  the backend failed to upsert (check Sentry for errors inside
  `api/revenuecat_webhook.py`).
- **`product_change` event not matching** — RC sends the new product under
  `event.new_product_identifier`; the backend upserts `product_id` from that
  field. If you rename a product, fire `Refresh subscription` from RC dashboard
  to resend the latest event.
- **Fail-safe to FREE** — the backend explicitly returns a default free
  `PremiumStatus` when no row exists for the user, on any DB error, or on an
  unexpected row shape. This is by design (Principle VI): never grant premium
  by mistake.
