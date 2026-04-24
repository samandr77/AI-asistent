# Second Brain Release Checklist

## 1. Supabase

- Create a Supabase project.
- Apply SQL migrations from `supabase/migrations/` in order:
  - `001_init.sql`
  - `002_memory_hnsw.sql`
  - `003_memory_rpc.sql`
  - `004_user_profiles_onboarding.sql`
- Enable Email auth in Supabase Auth.
- Decide whether email confirmation is required for sign-up.
- Copy:
  - Project URL
  - Publishable/anon key
  - Service role key
  - JWT secret

## 2. Backend Env

- Copy `backend/.env.example` to `backend/.env`.
- Fill in:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_JWT_SECRET`
  - `OPENAI_API_KEY`
  - `GROQ_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `HUGGINGFACE_API_KEY`
  - `ALLOWED_ORIGINS`
- Start backend locally:

```bash
cd second-brain/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Verify:

```bash
curl http://127.0.0.1:8000/health
```

## 3. Mobile/Web Env

- Copy `mobile/.env.example` to `mobile/.env`.
- Fill in:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_RC_IOS_KEY`
  - `EXPO_PUBLIC_RC_ANDROID_KEY`
  - `EXPO_PUBLIC_WEB_URL`

## 4. Local Testing

- Start app:

```bash
cd second-brain/mobile
npm install
npm run start:lan
```

- Verify:
  - sign up with email/password
  - profile setup saves correctly
  - first dump works
  - tasks sync after re-login
  - web opens with `npm run web`
  - desktop/web allows text dump flow

## 5. Web/Desktop Release

- Build static web bundle:

```bash
cd second-brain/mobile
npm run build:web
```

- Result is written to `mobile/dist`.
- Deploy `dist` using one of:
  - `eas deploy`
  - Vercel
  - Netlify
  - any static hosting

- On Mac/Windows:
  - open the deployed web app
  - install it as a PWA / desktop shortcut in the browser

## 6. iPhone / Android Preview Builds

- Log in to Expo:

```bash
cd second-brain/mobile
npx eas login
```

- Create preview builds:

```bash
npm run preview:ios
npm run preview:android
```

- Install preview build on devices and verify:
  - auth works
  - dump flow works
  - API calls hit production backend
  - tasks sync between phone and desktop web

## 7. Production Release

- Build production binaries:

```bash
cd second-brain/mobile
npm run release:ios
npm run release:android
```

- Submit to stores:

```bash
npm run submit:ios
npm run submit:android
```

## 8. Before Going Live

- Rotate any secrets that were ever stored in `.env` or committed locally.
- Add your final production web URL to backend `ALLOWED_ORIGINS`.
- Add final app store metadata and screenshots.
- Test the same user account on:
  - iPhone
  - Android
  - Mac web/PWA
  - Windows web/PWA

## 9. Nice Next Steps

- Add Apple Sign In for iPhone/iPad.
- Add Google Sign In for Android/web.
- Add password reset flow.
- Add a dedicated desktop wrapper later with Tauri or Electron if needed.
