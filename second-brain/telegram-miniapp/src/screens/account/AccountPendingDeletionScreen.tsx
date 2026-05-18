import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

interface PendingDeletionState {
  scheduled_for?: string;
}

export function AccountPendingDeletionScreen() {
  const { t } = useTranslation();
  const location = useLocation();
  const state = location.state as PendingDeletionState | null;
  const scheduledFor = state?.scheduled_for
    ? new Date(state.scheduled_for).toLocaleDateString()
    : t("accountDeletion.defaultDate");

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.accountPendingDeletion")}</h1>
        <div className="status">
          <strong>{t("accountDeletion.title")}</strong>
          <p className="muted">
            {t("accountDeletion.description", { date: scheduledFor })}
          </p>
        </div>
        <Link className="button" to="/launch">
          {t("launch.openTelegram")}
        </Link>
      </section>
    </main>
  );
}
