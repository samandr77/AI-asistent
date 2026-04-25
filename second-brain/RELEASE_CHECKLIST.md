# Second Brain — Release Checklist

**Goal**: Take a fresh clone to a submitted TestFlight / Play Internal Testing build in ≤ 4 hours.

Numbered, in dependency order. Do not skip ahead — each step assumes the previous ones are done.

---

## 1. Supabase — create project and apply migrations

1. Create a Supabase project (choose EU Frankfurt region for GDPR). Two projects: `dev` and `prod` — **never** apply destructive migrations to prod without manual review.
2. Open **SQL Editor** in dev, paste and run in order:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_memory_hnsw.sql`
   - `supabase/migrations/003_memory_rpc.sql`
   - `supabase/migrations/004_user_profiles_onboarding.sql`
   - `supabase/migrations/005_goals.sql`
   - `supabase/migrations/006_reflections.sql`
   - `supabase/migrations/007_premium.sql`
   - `supabase/migrations/008_user_ai_usage.sql`
   - `supabase/migrations/009_account_deletion.sql`  ← account-deletion (new)
3. Verify each migration applied cleanly (run `\dt public.*` equivalent or inspect tables in the Table Editor).
4. Save four credentials for later (both `dev` and `prod`):
   - Project URL
   - Anon/Publishable key
   - Service role key
   - JWT secret
5. Apply the same 9 migrations to the `prod` project once QA is green on dev.

## 2. Sentry

1. Create a Sentry org (or use existing).
2. Create two projects: `second-brain-backend` (Python/FastAPI), `second-brain-mobile` (React Native / Expo).
3. Copy each project's DSN.
4. Replace `YOUR_ORG_SLUG` in `second-brain/mobile/app.json` under the `@sentry/react-native/expo` plugin block with the real Sentry org slug.

## 3. Railway backend

1. Create a Railway service from the repo (root directory = `second-brain/backend`).
2. In **Variables**, set:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`  ← from step 1
   - `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `HUGGINGFACE_API_KEY`
   - `SENTRY_DSN` (backend DSN from step 2)
   - `ENVIRONMENT=production`
   - `ALLOWED_ORIGINS=https://second-brain.app,https://*.second-brain.app`
   - `DAILY_USER_TOKEN_BUDGET=200000`
   - `MAX_AUDIO_SECONDS=180`
   - `REVENUECAT_WEBHOOK_SECRET`  ← generated in step 7
   - `ADMIN_CLEANUP_SECRET`  ← generate with `openssl rand -base64 32`, keep for step 12
   - `DAILY_FREE_TOKEN_BUDGET=50000`
   - `DAILY_PREMIUM_TOKEN_BUDGET=500000`
   - `FREE_DAILY_DUMP_LIMIT=10`
   - `FREE_MAX_ACTIVE_GOALS=3`
   - `FREE_HISTORY_DAYS=30`
3. Deploy. Confirm `/health` returns 200 and `/health/ready` reports `sentry: true`.
4. Save `BACKEND_URL` (Railway-provided URL or custom domain `api.second-brain.app`).

## 4. Supabase OAuth (Apple + Google)

Follow `second-brain/docs/oauth-setup.md`:

- Enable Apple provider in Supabase Auth (Service ID, Team ID, Key ID, p8 key).
- Enable Google provider (Web + iOS + Android client IDs).
- Whitelist redirect URIs for each provider.
- Copy the `iosUrlScheme` (reversed iOS client ID) for step 5.

## 5. Mobile app.json + EAS config

1. Open `second-brain/mobile/app.json`:
   - Replace `com.googleusercontent.apps.REPLACE_WITH_REVERSED_IOS_CLIENT_ID` with the real reversed iOS client ID from step 4.
   - Replace `YOUR_ORG_SLUG` in the Sentry plugin block (done in step 2 — double-check).
2. Verify `plugins` array ends with `./plugins/withPrivacyManifest.js` — keeps the iOS privacy manifest in sync on every prebuild.
3. Create `second-brain/mobile/.env` (not committed) with:
   ```
   EXPO_PUBLIC_API_URL=https://<backend-url-from-step-3>
   EXPO_PUBLIC_SUPABASE_URL=https://<dev-project-url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<dev-anon-key>
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=... (step 7)
   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=... (step 7)
   ```
4. For production builds, upload the same variables as EAS secrets:
   ```
   eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.second-brain.app
   ```
   Repeat for each `EXPO_PUBLIC_*` variable that should be baked into prod builds.

## 6. RevenueCat products + webhook

Follow `second-brain/docs/revenuecat-setup.md`:

1. Create a RevenueCat project, add iOS + Android apps.
2. Create products `premium_monthly` (4.99/mo) and `premium_yearly` (49.99/yr) in both stores.
3. Create an **Entitlement** named `premium` and attach both products.
4. Configure Webhook → URL: `<BACKEND_URL>/webhooks/revenuecat`, secret: value of `REVENUECAT_WEBHOOK_SECRET` (step 3).
5. Copy public API keys (iOS and Android) into step 5.3 (.env) and step 5.4 (EAS secret).

## 7. Legal static site

1. `cd docs/legal-site && npm install && vercel link` (create project `second-brain-legal`).
2. `vercel --prod` for the first deploy.
3. In Vercel dashboard → Settings → Domains — attach `second-brain.app` (apex).
4. Update DNS (A record to Vercel, or ALIAS / CNAME where supported).
5. Wait for SSL (≤ 5 min). Verify `https://second-brain.app/privacy` and `/terms` open.
6. **Then** `docs/legal/*.md` files should be filled by the lawyer — `{{TODO:}}` markers flag sections that need final text.
7. Mobile app already reads `privacyUrl` and `termsUrl` from `app.json` `expo.extra` — no code changes needed.

## 8. Preview build + smoke test

```
cd second-brain/mobile
eas build --profile preview --platform all
```

On each test device (one iOS, one Android), walk through:

- [ ] Welcome → Sign in with Apple → land on onboarding/setup
- [ ] Onboarding setup → first dump (text and voice) → result screen
- [ ] Create a task manually, toggle `is_today`, mark done
- [ ] Create a goal, link a task to it, view progress
- [ ] Open paywall → "Restore purchases" → handle both "none found" and active paths
- [ ] Evening reflection flow; verify streak count increments
- [ ] Profile → **Delete account** → confirm → land on welcome screen
- [ ] Re-sign-in as same user → verify `/auth/me` returns 410 (backend logs) and UI routes to welcome

## 9. Store-listing content + screenshots

1. App Store Connect: create app record, fill metadata from `docs/store-listing/ios-ru.md` and `docs/store-listing/ios-en.md`.
2. Google Play Console: create internal-testing track, fill from `docs/store-listing/android-*.md`.
3. Run `docs/store-listing/screenshots/generate-placeholders.sh` if designer has not delivered real captures yet — gives you something to upload.
4. Upload five screenshots per device class (1320×2868, 1284×2778, 2064×2752, 1080×1920, 1200×1920).
5. Paste Privacy Policy URL (from step 7) and Support URL into each store console.
6. In Play Console: fill the **Data safety** section per `docs/store-listing/android-ru.md`.

## 10. Production build + submission

```
eas build --profile production --platform all
eas submit --profile production --platform all
```

- [ ] iOS build uploads to App Store Connect → TestFlight internal testers activated within ~30 min.
- [ ] Android build uploads to Play Console → "Internal testing" track → tester link works.

## 11. Automation: GitHub Actions secrets

Go to repo **Settings → Secrets and variables → Actions** and set:

- `ADMIN_CLEANUP_SECRET` (same as Railway step 3)
- `BACKEND_URL` (step 3)
- For optional manual RLS runs: `DEV_SUPABASE_URL`, `DEV_SUPABASE_SERVICE_KEY`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_JWT_SECRET`

Verify:
- `.github/workflows/cleanup-cron.yml` — runs daily 04:15 UTC. Trigger once manually via Actions tab to confirm it returns a 200 report.
- `.github/workflows/backend.yml` and `mobile.yml` — green on the production branch.
- `.github/workflows/rls-integration.yml` — manual-dispatch only; run once against dev to validate.

## 12. Rollback plan

Keep printed / pinned so it is available during an incident.

- **Supabase migration**: `alter table user_profiles drop column deleted_at; drop function cascade_delete_user(uuid);` reverts migration 009 only. For earlier migrations, inspect `supabase/migrations/` and reverse-engineer — Supabase has no automatic down migrations.
- **Railway deploy**: in Railway dashboard → Deployments → click the previous successful deploy → "Redeploy". Reverts backend in < 2 min.
- **EAS release**: `eas build:list` → pick last-good build → download archive → re-submit via `eas submit` with that archive.
- **Vercel legal site**: `vercel rollback` in `docs/legal-site` falls back to the previous deploy.
- **Incident runbook**: `docs/runbooks/account-cleanup.md` for the cleanup-cron endpoint specifically.

## Sanity checks before flipping to public

- [ ] All migrations applied to prod Supabase.
- [ ] `curl https://api.second-brain.app/health/ready` → `{"status":"ok","environment":"production","sentry":true}`.
- [ ] `curl -X POST -H "Authorization: Bearer $ADMIN_CLEANUP_SECRET" https://api.second-brain.app/admin/cleanup-deleted` → `{"processed":0,...}` (no users yet).
- [ ] `https://second-brain.app/privacy?lang=en` opens in a browser and displays the English privacy policy.
- [ ] Review App Store Connect + Play Console listings for the last time. Click "Submit for review".

Once in review: nothing more to do. Wait 24-48h (iOS) / 2-24h (Android) for first reply.

## References

- OAuth setup: `second-brain/docs/oauth-setup.md`
- RevenueCat setup: `second-brain/docs/revenuecat-setup.md`
- Cleanup-cron runbook: `docs/runbooks/account-cleanup.md`
- Legal site deploy: `docs/legal-site/README.md`
- Store-listing content: `docs/store-listing/`
- RLS integration test guide: `.github/workflows/rls-integration.yml`
