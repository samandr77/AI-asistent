import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import {
  deleteAccount,
  getMe,
  getMemoryProfile,
  getPremiumStatus,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import { useSessionStore } from "../../store/useSessionStore";

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const todayTasks = useAppStore((state) => state.todayTasks);
  const allTasks = useAppStore((state) => state.allTasks);
  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: getMe });
  const premiumQuery = useQuery({
    queryKey: ["premium-status"],
    queryFn: getPremiumStatus,
  });
  const memoryQuery = useQuery({
    queryKey: ["memory-profile"],
    queryFn: getMemoryProfile,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: (response) => {
      clearSession();
      navigate("/account/pending-deletion", {
        replace: true,
        state: { scheduled_for: response.scheduled_for },
      });
    },
  });
  const profile = meQuery.data?.profile;
  const displayName = profile?.name ?? user?.name ?? "Telegram";
  const username = user?.username ? `@${user.username}` : null;

  function signOut() {
    clearSession();
    navigate("/launch", { replace: true });
  }

  function requestDeletion() {
    const confirmText = premiumQuery.data?.is_premium
      ? t("profile.deletePremiumConfirm")
      : t("profile.deleteConfirm");
    if (window.confirm(confirmText)) {
      deleteMutation.mutate();
    }
  }

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.profile")}</h1>
        <div className="status profile-head">
          {user?.photo_url ? (
            <img alt="" className="avatar" src={user.photo_url} />
          ) : (
            <div className="avatar fallback">{displayName.slice(0, 1)}</div>
          )}
          <div>
            <strong>{displayName}</strong>
            {username ? <p className="muted">{username}</p> : null}
            <p className="muted">
              {premiumQuery.data?.is_premium
                ? t("profile.premiumActive")
                : t("profile.freePlan")}
            </p>
          </div>
        </div>
        <div className="metric-grid">
          <div className="status">
            <strong>{todayTasks.length}</strong>
            <span>{t("profile.todayTasks")}</span>
          </div>
          <div className="status">
            <strong>{allTasks.filter((task) => task.is_done).length}</strong>
            <span>{t("profile.doneTasks")}</span>
          </div>
        </div>
        <LanguageSwitcher />
        <div className="status">
          <strong>{t("profile.memoryPreview")}</strong>
          {memoryQuery.data?.length ? (
            <p className="muted">{memoryQuery.data[0].content}</p>
          ) : (
            <p className="muted">{t("profile.memoryEmpty")}</p>
          )}
        </div>
        <div className="list">
          <Link className="row-link" to="/reflections/settings">
            <strong>{t("screens.reflectionSettings")}</strong>
            <span>{t("profile.remindersHint")}</span>
          </Link>
          <Link className="row-link" to="/premium">
            <strong>{t("screens.premium")}</strong>
            <span>{t("profile.premiumHint")}</span>
          </Link>
          <Link className="row-link" to="/support">
            <strong>{t("screens.support")}</strong>
            <span>{t("profile.supportHint")}</span>
          </Link>
          <a className="row-link" href="https://second-brain.app/privacy">
            <strong>{t("profile.privacy")}</strong>
            <span>second-brain.app/privacy</span>
          </a>
          <a className="row-link" href="https://second-brain.app/terms">
            <strong>{t("profile.terms")}</strong>
            <span>second-brain.app/terms</span>
          </a>
        </div>
        {deleteMutation.error ? (
          <p className="error-text">{t("profile.deleteError")}</p>
        ) : null}
        <div className="action-row">
          <button className="button secondary" type="button" onClick={signOut}>
            {t("profile.signOut")}
          </button>
          <button
            className="button danger"
            disabled={deleteMutation.isPending}
            type="button"
            onClick={requestDeletion}
          >
            {deleteMutation.isPending ? t("common.loading") : t("profile.deleteAccount")}
          </button>
        </div>
      </section>
    </main>
  );
}
