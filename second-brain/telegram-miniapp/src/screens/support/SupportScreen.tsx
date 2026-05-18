import { useTranslation } from "react-i18next";

export function SupportScreen() {
  const { t } = useTranslation();
  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.support")}</h1>
        <div className="status">
          <strong>{t("support.title")}</strong>
          <p className="muted">{t("support.description")}</p>
        </div>
        <div className="list">
          <a className="row-link" href="mailto:support@second-brain.app">
            <strong>support@second-brain.app</strong>
            <span>{t("support.emailHint")}</span>
          </a>
          <a className="row-link" href="https://second-brain.app/privacy">
            <strong>{t("profile.privacy")}</strong>
            <span>second-brain.app/privacy</span>
          </a>
          <a className="row-link" href="https://second-brain.app/terms">
            <strong>{t("profile.terms")}</strong>
            <span>second-brain.app/terms</span>
          </a>
        </div>
      </section>
    </main>
  );
}
