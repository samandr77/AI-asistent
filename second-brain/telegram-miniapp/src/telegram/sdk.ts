export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramHapticFeedback {
  impactOccurred: (
    style: "light" | "medium" | "heavy" | "rigid" | "soft",
  ) => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  version?: string;
  platform?: string;
  BackButton?: TelegramBackButton;
  HapticFeedback?: TelegramHapticFeedback;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openInvoice?: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void,
  ) => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  MainButton?: {
    text: string;
    isVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramRuntime(webApp = getTelegramWebApp()): boolean {
  return Boolean(webApp?.initData);
}

export function getTelegramInitData(webApp = getTelegramWebApp()): string {
  return webApp?.initData ?? "";
}

export function getTelegramStartParam(
  webApp = getTelegramWebApp(),
): string | null {
  return webApp?.initDataUnsafe?.start_param ?? null;
}

export function configureTelegramViewport(
  webApp = getTelegramWebApp(),
): void {
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
}
