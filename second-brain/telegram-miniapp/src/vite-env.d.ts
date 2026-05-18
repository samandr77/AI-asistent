/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ENV?: string;
  readonly VITE_TELEGRAM_DEV_MODE?: string;
  readonly VITE_TELEGRAM_DEV_START_PARAM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
