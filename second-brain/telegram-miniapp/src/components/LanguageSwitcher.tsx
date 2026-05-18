import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { updateProfile } from "../services/api";

const languages = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const mutation = useMutation({
    mutationFn: (language: string) => updateProfile({ language }),
  });

  function setLanguage(language: string) {
    void i18n.changeLanguage(language);
    mutation.mutate(language);
  }

  return (
    <div className="segmented compact" role="group" aria-label="Language">
      {languages.map((language) => (
        <button
          className={i18n.language.startsWith(language.code) ? "active" : ""}
          key={language.code}
          type="button"
          onClick={() => setLanguage(language.code)}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
