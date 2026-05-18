import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import ru from "../locales/ru.json";
import en from "../locales/en.json";

function pickInitialLocale(): "ru" | "en" {
  const locales = Localization.getLocales();
  const code =
    locales && locales.length > 0 ? locales[0].languageCode : undefined;
  return code === "ru" ? "ru" : "en";
}

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;

  i18n.use(initReactI18next).init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: pickInitialLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });
}

export { i18n };
