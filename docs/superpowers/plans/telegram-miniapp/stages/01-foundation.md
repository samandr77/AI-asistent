# Stage 1 - Mini App Foundation

## Objective

Create the Telegram Mini App web client shell with routing, Telegram SDK integration, theming, state, API client, testing, and build pipeline.

## Work To Do

- Create `second-brain/telegram-miniapp/`.
- Add Vite + React + TypeScript strict.
- Add React Router or TanStack Router.
- Add Telegram SDK wrapper.
- Add Telegram theme support:
  - color scheme.
  - theme params.
  - safe area and viewport height.
  - bottom bar color.
- Add Telegram navigation support:
  - BackButton.
  - Main/BottomButton abstraction if used.
  - haptics helper.
  - start parameter parser.
- Add browser Sentry setup.
- Add i18n with RU/EN.
- Add API client with app session token injection.
- Add query/server-state layer.
- Add local storage abstraction:
  - IndexedDB or localStorage fallback.
  - optional Telegram DeviceStorage wrapper when available.
- Add placeholder routes for all screens in the roadmap.
- Add unsupported-state screen for non-Telegram browser.
- Add dev mode for local browser testing with fake launch data.

## Target Structure

```text
second-brain/telegram-miniapp/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── app/
│   ├── telegram/
│   ├── services/
│   ├── store/
│   ├── screens/
│   ├── components/
│   ├── locales/
│   └── types/
└── tests/
```

## Routes To Stub

- `/`
- `/unsupported`
- `/onboarding/setup`
- `/onboarding/first-dump`
- `/today`
- `/dump`
- `/result/:dumpId`
- `/tasks`
- `/tasks/:id`
- `/goals`
- `/goals/new`
- `/goals/:id`
- `/reflection`
- `/reflection/today`
- `/reflection/:date`
- `/reflection/settings`
- `/premium`
- `/profile`
- `/account-pending-deletion`
- `/support`

## Files To Create Or Update

- `second-brain/telegram-miniapp/package.json`
- `second-brain/telegram-miniapp/vite.config.ts`
- `second-brain/telegram-miniapp/src/app/App.tsx`
- `second-brain/telegram-miniapp/src/app/routes.tsx`
- `second-brain/telegram-miniapp/src/app/providers.tsx`
- `second-brain/telegram-miniapp/src/telegram/sdk.ts`
- `second-brain/telegram-miniapp/src/telegram/theme.ts`
- `second-brain/telegram-miniapp/src/telegram/navigation.ts`
- `second-brain/telegram-miniapp/src/services/api.ts`
- `second-brain/telegram-miniapp/src/services/sentry.ts`
- `second-brain/telegram-miniapp/src/locales/ru.json`
- `second-brain/telegram-miniapp/src/locales/en.json`

## Tests

- TypeScript strict build passes.
- Router renders every route.
- Unsupported browser state appears when no Telegram launch data exists and dev mode is disabled.
- Theme variables are applied from Telegram theme params.
- API client attaches `Authorization` after token is set.

## Acceptance Criteria

- `npm run build` succeeds.
- `npm run typecheck` succeeds.
- Every planned screen has a route and placeholder.
- Telegram SDK access is isolated to `src/telegram/*`.
- No product screen imports `window.Telegram` directly.
