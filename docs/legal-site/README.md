# Legal site

Next.js 14 App Router site that renders `docs/legal/*.md` at
`https://second-brain.app/privacy` and `/terms`. Deployed to Vercel.

## Local preview

```bash
cd docs/legal-site
npm install
npm run dev   # http://localhost:3000/privacy?lang=ru
```

## Deploy (one-time setup)

```bash
cd docs/legal-site
npx vercel link         # choose or create Vercel project "second-brain-legal"
npx vercel --prod       # first production deploy
```

Then in the Vercel dashboard:
1. Settings → Domains → add `second-brain.app` (root domain).
2. Update the DNS provider with the A / CNAME record Vercel gives you.
3. Wait for SSL provisioning (≤ 5 min).

## Continuous deploy

Vercel auto-deploys on push to master. No GitHub Actions workflow needed.

## Content

Edit markdown in `../legal/*.md` — the site reads them at build time. On push,
Vercel rebuilds and serves the updated content.

Supported languages: `ru` (default), `en`. URL param `?lang=en` switches language.

## Paths referenced from mobile app

`second-brain/mobile/app.json` `expo.extra`:
- `privacyUrl`: `https://second-brain.app/privacy`
- `termsUrl`: `https://second-brain.app/terms`
