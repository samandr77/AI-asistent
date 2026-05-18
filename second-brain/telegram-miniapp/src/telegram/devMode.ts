import type { TelegramWebApp } from "./sdk";

function createNoopBackButton() {
  return {
    isVisible: false,
    show() {
      this.isVisible = true;
    },
    hide() {
      this.isVisible = false;
    },
    onClick() {},
    offClick() {},
  };
}

export function installTelegramDevMode(): void {
  if (!import.meta.env.DEV || import.meta.env.VITE_TELEGRAM_DEV_MODE !== "1") {
    return;
  }
  const user = {
    id: 100000001,
    first_name: "Local",
    last_name: "Tester",
    username: "second_brain_local",
    language_code: navigator.language.startsWith("ru") ? "ru" : "en",
  };
  const startParam = import.meta.env.VITE_TELEGRAM_DEV_START_PARAM ?? "";
  const initData = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: Math.floor(Date.now() / 1000).toString(),
    start_param: startParam,
    hash: "local-dev-only",
  }).toString();

  const fakeWebApp: TelegramWebApp = {
    initData,
    initDataUnsafe: {
      user,
      start_param: startParam || undefined,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "local-dev-only",
    },
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    themeParams: {},
    version: "local-dev",
    platform: "browser",
    BackButton: createNoopBackButton(),
    HapticFeedback: {
      impactOccurred() {},
      notificationOccurred() {},
      selectionChanged() {},
    },
    ready() {},
    expand() {},
    close() {},
  };

  window.Telegram = { WebApp: fakeWebApp };
}
