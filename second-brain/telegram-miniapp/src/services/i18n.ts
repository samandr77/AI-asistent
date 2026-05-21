import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import ru from "../locales/ru.json";

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;

  i18n.use(initReactI18next).init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: "ru",
    fallbackLng: "ru",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });
}

export { i18n };
