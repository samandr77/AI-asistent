# OAuth Sign-In Setup Guide

This document covers the exact steps to activate Apple Sign In and Google Sign In for the Second Brain app. Follow every step — missing any one will cause sign-in to silently fail or show a cryptic error.

---

## Prerequisites

- Apple Developer Account (paid, $99/yr)
- Google Cloud Console project
- Supabase project (already configured)
- EAS CLI (`npm install -g eas-cli`)

---

## 1. Apple Sign In

### 1.1 Enable in Apple Developer Portal

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**
2. Find your App ID: `com.secondbrain.app` (must match `app.json` → `ios.bundleIdentifier`)
3. Click on it → check **Sign in with Apple** → Save
4. Confirm: the capability now shows as **Enabled**

### 1.2 Create a Services ID (for Supabase callback)

1. In **Identifiers**, click **+** → choose **Services IDs** → Continue
2. Description: `Second Brain Sign In`
3. Identifier: `com.secondbrain.app.signin` (must be unique; note this value)
4. Click **Register**
5. Click on the newly created Services ID → check **Sign in with Apple** → **Configure**
6. Primary App ID: select `com.secondbrain.app`
7. Domains and Subdomains: `<your-project-ref>.supabase.co` (no `https://`)
8. Return URLs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
9. Save → Done → Continue → Register

### 1.3 Create a Sign In with Apple Key

1. Go to **Keys** → **+**
2. Key Name: `Second Brain Apple Key`
3. Check **Sign in with Apple** → **Configure** → select `com.secondbrain.app` as Primary App ID → Save
4. Click **Register**
5. **Download the .p8 file immediately** — you cannot download it again
6. Note the **Key ID** (10-character string shown on the confirmation page)
7. Note your **Team ID** (visible in top-right of Apple Developer portal under your name)

### 1.4 Configure in Supabase Dashboard

1. Go to **Supabase Dashboard** → your project → **Authentication** → **Providers** → **Apple**
2. Toggle **Enable Apple provider** → ON
3. Fill in:
   - **Services ID (client_id)**: `com.secondbrain.app.signin` (from step 1.2)
   - **Team ID**: your Team ID (from step 1.3)
   - **Key ID**: the 10-char Key ID (from step 1.3)
   - **Private Key**: paste entire contents of the `.p8` file (including `-----BEGIN PRIVATE KEY-----` lines)
4. Click **Save**

**No mobile env var needed** — Apple Sign In on iOS uses a native entitlement, not a secret. The Supabase dashboard config handles the server-side validation.

---

## 2. Google Sign In

### 2.1 Create OAuth Credentials in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one named `second-brain`)
3. Go to **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth 2.0 Client ID**

**Create Web Client ID:**
1. Application type: **Web application**
2. Name: `Second Brain Web`
3. Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Click **Create**
5. Note the **Client ID** and **Client Secret** — you'll need both for Supabase

**Create iOS Client ID:**
1. Application type: **iOS**
2. Name: `Second Brain iOS`
3. Bundle ID: `com.secondbrain.app` (must match `app.json` → `ios.bundleIdentifier`)
4. Click **Create**
5. Note the **iOS Client ID** (format: `XXXXXXXXXX-xxxx.apps.googleusercontent.com`)
6. Note the **Reversed Client ID** (format: `com.googleusercontent.apps.XXXXXXXXXX-xxxx`) — needed for `app.json`

### 2.2 Update app.json with Reversed iOS Client ID

In `second-brain/mobile/app.json`, find the Google plugin:

```json
["@react-native-google-signin/google-signin", {
  "iosUrlScheme": "com.googleusercontent.apps.REPLACE_WITH_REVERSED_IOS_CLIENT_ID"
}]
```

Replace `REPLACE_WITH_REVERSED_IOS_CLIENT_ID` with the actual reversed client ID from step 2.1.
Example: `com.googleusercontent.apps.1234567890-abcdefghijklmnop`

### 2.3 Set Environment Variables

In `second-brain/mobile/.env` (create from `.env.example`):

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Web Client ID from step 2.1>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS Client ID from step 2.1>
```

**Important**: If `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is empty or missing, the Google Sign In button will NOT appear in the UI. This is intentional — the button is hidden rather than broken.

### 2.4 Configure in Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
2. Toggle **Enable Google provider** → ON
3. Fill in:
   - **Client ID (for OAuth)**: Web Client ID (the one that ends in `.apps.googleusercontent.com`)
   - **Client Secret**: Web Client Secret
4. Click **Save**

---

## 3. Supabase Settings

### 3.1 Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add: `secondbrain://` (the scheme from `app.json`)
3. Also add for web testing: `https://your-app.expo.app/`
4. Click **Save**

### 3.2 Enable Identity Linking (critical for duplicate email handling)

If a user signs in with Google using the same email as an existing email/password account, Supabase creates a second account by default — unless identity linking is enabled.

1. Go to **Authentication** → **Providers** → scroll to bottom → **Auth Providers**
2. Enable **"Allow multiple identities for the same user"** (or similar toggle — exact UI may vary by Supabase version)
3. Alternative name in newer Supabase: **Identity Linking** or **Allow unverified identities**

Without this: users who try OAuth with an email that already has a password account will get a second orphaned account. Document this to your users or enable it before launch.

---

## 4. Rebuild EAS Dev Client

Because plugins changed (`expo-apple-authentication`, `@react-native-google-signin/google-signin`), you MUST rebuild the native binary. The existing dev client will not include the new native modules.

```bash
cd second-brain/mobile

# Rebuild dev client for both platforms
eas build --profile development --platform ios
eas build --profile development --platform android

# Or rebuild just one platform:
eas build --profile development --platform ios
```

After the build completes, install the new dev client on your device/simulator, then run:

```bash
npx expo start --dev-client
```

---

## 5. Android-specific: Create Android OAuth Client (optional)

If you need Google Sign In on Android:

1. In Google Cloud Console → **Credentials** → **+ Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Android**
3. Package name: `com.secondbrain.app` (must match `app.json` → `android.package`)
4. SHA-1 certificate fingerprint: run `eas credentials --platform android` to get your keystore SHA-1
5. Click **Create**

No additional env var needed for Android — the Web Client ID is used for both platforms.

---

## 6. Troubleshooting

### "DEVELOPER_ERROR" on Android (Google Sign In)

- SHA-1 fingerprint mismatch: your Android OAuth client ID was created with a different keystore
- Run `eas credentials --platform android` to get the correct SHA-1 and update the Google Cloud credential

### "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)"

- App ID doesn't have "Sign in with Apple" capability enabled (step 1.1)
- Services ID return URL doesn't match Supabase callback URL (step 1.2)
- Rebuild dev client after enabling the entitlement

### "nonce validation failed" from Supabase

- The raw nonce and hashed nonce are mismatched — this is a code bug, not a config issue
- Check that `services/auth.ts` passes `rawNonce` to Supabase and `hashedNonce` (SHA-256) to Apple

### Google button not appearing

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is empty in `.env`
- The button is intentionally hidden when env var is missing — set the var and restart Metro

### "Invalid login credentials" after Apple Sign In

- Services ID is not configured in Supabase dashboard (step 1.4)
- The `.p8` key was entered incorrectly — re-paste with all line breaks preserved

### Session not restored after app restart

- This is handled automatically by Supabase JS client via MMKV storage
- If sessions are not restored, check that `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct in `.env`

---

## Summary Checklist

- [ ] Apple App ID has "Sign in with Apple" enabled
- [ ] Apple Services ID created with correct return URL
- [ ] Apple Key (.p8) downloaded and Key ID noted
- [ ] Supabase Apple provider enabled with Services ID, Team ID, Key ID, private key
- [ ] Google Web Client ID created with Supabase callback as redirect URI
- [ ] Google iOS Client ID created with matching bundle ID
- [ ] `app.json` updated with reversed iOS client ID in `iosUrlScheme`
- [ ] `mobile/.env` has `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- [ ] Supabase Google provider enabled with Web Client ID and secret
- [ ] Supabase redirect URLs include `secondbrain://`
- [ ] Supabase identity linking enabled (for duplicate email accounts)
- [ ] EAS dev client rebuilt after plugin changes
