import type { TelegramThemeParams, TelegramWebApp } from "./sdk";

const themeVariableMap: Record<keyof TelegramThemeParams, string> = {
  bg_color: "--tg-bg-color",
  text_color: "--tg-text-color",
  hint_color: "--tg-hint-color",
  link_color: "--tg-link-color",
  button_color: "--tg-button-color",
  button_text_color: "--tg-button-text-color",
  secondary_bg_color: "--surface-color",
};

export function applyTelegramTheme(webApp: TelegramWebApp | null): void {
  if (!webApp?.themeParams) return;

  for (const [telegramKey, cssVariable] of Object.entries(themeVariableMap)) {
    const value = webApp.themeParams[telegramKey as keyof TelegramThemeParams];
    if (value) {
      document.documentElement.style.setProperty(cssVariable, value);
    }
  }
}
