import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { AppLogo } from "../../assets/AppLogo";
import { useSessionStore } from "../../store/useSessionStore";
import {
  AccountPendingDeletionError,
  createDevSession,
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
  const [busy, setBusy] = useState(true);
  const hasInitData = isTelegramRuntime();
  const initDataLength = getTelegramInitData().length;

  useEffect(() => {
    let cancelled = false;
    const minSplashMs = 900;
    const splashStartedAt = Date.now();

    async function bootstrap() {
      setError(null);
      setBusy(true);

      const finish = async (target: string | null) => {
        const elapsed = Date.now() - splashStartedAt;
        const remaining = Math.max(0, minSplashMs - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        if (cancelled) return;
        if (target) {
          navigate(target, { replace: true });
        } else {
          setBusy(false);
        }
      };

      if (isLocalPreviewMode()) {
        setSession("local-preview-token", localPreviewUser);
        await finish("/today");
        return;
      }
      if (!hasInitData) {
        if (sessionToken) {
          setBootstrapping(false);
          await finish("/today");
          return;
        }
        if (import.meta.env.DEV) {
          setBootstrapping(true);
          try {
            const session = await createDevSession();
            if (cancelled) return;
            setSession(session.access_token, session.user);
            await finish(routeAfterTelegramSession(session));
            return;
          } catch {
            // dev-session disabled on backend — fall through to manual UI
          }
        }
        setBootstrapping(false);
        await finish(null);
        return;
      }

      setBootstrapping(true);
      try {
        const session = await createTelegramSession();
        if (cancelled) return;
        setSession(session.access_token, session.user);
        await finish(routeAfterTelegramSession(session));
      } catch (err) {
        if (cancelled) return;
        setBootstrapping(false);
        if (err instanceof AccountPendingDeletionError) {
          await finish("/account/pending-deletion");
          return;
        }
        setError(t("launch.error"));
        await finish(null);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hasInitData, navigate, sessionToken, setBootstrapping, setSession, t]);

  const statusText = busy
    ? t("launch.statusConnecting")
    : hasInitData
      ? t("launch.statusTelegram")
      : t("launch.statusBrowser");

  return (
    <main className="launch-splash" aria-busy={busy}>
      <div className="launch-splash__glow" aria-hidden="true" />
      <section className="launch-splash__card">
        <div className="launch-splash__logo">
          <AppLogo />
        </div>
        <h1 className="launch-splash__brand">{t("launch.brand")}</h1>
        <p className="launch-splash__tagline">{t("launch.description")}</p>

        <div className="launch-splash__status" role="status" aria-live="polite">
          {busy ? (
            <span className="launch-splash__spinner" aria-hidden="true" />
          ) : null}
          <span className="launch-splash__status-text">{statusText}</span>
        </div>

        {!busy && initDataLength > 0 ? (
          <p className="launch-splash__hint">
            {t("launch.initDataLength", { count: initDataLength })}
          </p>
        ) : null}

        {error ? <p className="launch-splash__error">{error}</p> : null}

        {!busy ? (
          <nav className="launch-splash__actions" aria-label="Launch actions">
            <Link
              className="launch-splash__button"
              to={hasInitData ? "/launch" : "/unsupported"}
            >
              {hasInitData ? t("common.loading") : t("launch.openTelegram")}
            </Link>
            <Link
              className="launch-splash__button launch-splash__button--ghost"
              to="/onboarding/setup"
            >
              {t("onboarding.setupTitle")}
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
