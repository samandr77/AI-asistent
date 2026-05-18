import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/routes";
import { initI18n } from "./services/i18n";
import { initSentry } from "./services/sentry";
import { installTelegramDevMode } from "./telegram/devMode";
import { configureTelegramViewport, getTelegramWebApp } from "./telegram/sdk";
import { applyTelegramTheme } from "./telegram/theme";
import "./styles.css";

installTelegramDevMode();
initSentry();
initI18n();

const webApp = getTelegramWebApp();
configureTelegramViewport(webApp);
applyTelegramTheme(webApp);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
