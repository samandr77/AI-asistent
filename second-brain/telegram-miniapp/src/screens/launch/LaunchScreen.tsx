import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useSessionStore } from "../../store/useSessionStore";
import {
  AccountPendingDeletionError,
  createTelegramSession,
  routeAfterTelegramSession,
} from "../../telegram/auth";
import { getTelegramInitData, isTelegramRuntime } from "../../telegram/sdk";
import type { TelegramSessionUser } from "../../types/api";

const localPreviewUser: TelegramSessionUser = {
  id: "local-preview-user",
  telegram_user_id: 100000001,
  provider: "telegram",
  name: "Local Tester",
  username: "second_brain_local",
  language: "ru",
  is_onboarded: true,
};

function isLocalPreviewMode(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW_DATA === "1";
}

export function LaunchScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionToken, setBootstrapping, setSession } = useSessionStore();
  const [error, setError] = useState<string | null>(null);
  const hasInitData = isTelegramRuntime();
  const initDataLength = getTelegramInitData().length;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError(null);
      if (isLocalPreviewMode()) {
        setSession("local-preview-token", localPreviewUser);
        navigate("/today", { replace: true });
        return;
      }
      if (!hasInitData) {
        setBootstrapping(false);
        if (sessionToken) {
          navigate("/today", { replace: true });
        }
        return;
      }

      setBootstrapping(true);
      try {
        const session = await createTelegramSession();
        if (cancelled) return;
        setSession(session.access_token, session.user);
        navigate(routeAfterTelegramSession(session), { replace: true });
      } catch (err) {
        if (cancelled) return;
        setBootstrapping(false);
        if (err instanceof AccountPendingDeletionError) {
          navigate("/account/pending-deletion", {
            replace: true,
            state: { scheduledFor: err.scheduledFor },
          });
          return;
        }
        setError(t("launch.error"));
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hasInitData, navigate, sessionToken, setBootstrapping, setSession, t]);

  return (
    <main className="screen">
      <section className="panel">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("launch.title")}</h1>
        <p className="muted">{t("launch.description")}</p>
        <div className="status">
          <strong>
            {hasInitData ? t("launch.statusTelegram") : t("launch.statusBrowser")}
          </strong>
          <p className="muted">
            {t("launch.initDataLength", { count: initDataLength })}
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
        <nav className="action-row" aria-label="Launch actions">
          <Link className="button" to={hasInitData ? "/launch" : "/unsupported"}>
            {hasInitData ? t("common.loading") : t("launch.openTelegram")}
          </Link>
          <Link className="button secondary" to="/onboarding/setup">
            {t("onboarding.setupTitle")}
          </Link>
        </nav>
      </section>
    </main>
  );
}
