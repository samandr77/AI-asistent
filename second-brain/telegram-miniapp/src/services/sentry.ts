import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_ENV ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    tracesSampleRate: 0.2,
  });
}

export { Sentry };
