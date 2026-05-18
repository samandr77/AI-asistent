import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../app/screens";
import { useSessionStore } from "../../store/useSessionStore";

export function UnsupportedScreen() {
  const { t } = useTranslation();
  const sessionToken = useSessionStore((state) => state.sessionToken);

  if (sessionToken) {
    return (
      <PlaceholderScreen
        title={t("launch.unsupportedTitle")}
        description={t("launch.unsupportedHasSession")}
      />
    );
  }

  return (
    <main className="screen">
      <section className="panel">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("launch.unsupportedTitle")}</h1>
        <p className="muted">{t("launch.unsupportedDescription")}</p>
        <div className="action-row">
          <Link className="button secondary" to="/launch">
            {t("common.back")}
          </Link>
        </div>
      </section>
    </main>
  );
}
