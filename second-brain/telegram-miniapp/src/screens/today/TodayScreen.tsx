import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { TaskCard } from "../../components/TaskCard";
import { getTodayTasks } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";

export function TodayScreen() {
  const { t } = useTranslation();
  const setTodayTasks = useAppStore((state) => state.setTodayTasks);
  const pendingTextDumps = useAppStore((state) => state.pendingTextDumps);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: getTodayTasks,
  });

  useEffect(() => {
    if (data) {
      setTodayTasks(data);
    }
  }, [data, setTodayTasks]);

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.today")}</h1>
        <nav className="action-row">
          <Link className="button" to="/dump">
            {t("common.dump")}
          </Link>
          <Link className="button secondary" to="/tasks">
            {t("common.tasks")}
          </Link>
          <Link className="button secondary" to="/finance">
            Финансы
          </Link>
        </nav>
        <section className="roadmap-panel" aria-label={t("today.roadmapTitle")}>
          <div>
            <h2>{t("today.roadmapTitle")}</h2>
            <p>{t("today.roadmapIntro")}</p>
          </div>
          <div className="roadmap-steps">
            <Link className="roadmap-step" to="/dump">
              <strong>{t("today.roadmapCaptureTitle")}</strong>
              <span>{t("today.roadmapCaptureText")}</span>
            </Link>
            <Link className="roadmap-step" to="/tasks">
              <strong>{t("today.roadmapPlanTitle")}</strong>
              <span>{t("today.roadmapPlanText")}</span>
            </Link>
            <Link className="roadmap-step" to="/finance">
              <strong>{t("today.roadmapFinanceTitle")}</strong>
              <span>{t("today.roadmapFinanceText")}</span>
            </Link>
            <Link className="roadmap-step" to="/reflections/today">
              <strong>{t("today.roadmapReviewTitle")}</strong>
              <span>{t("today.roadmapReviewText")}</span>
            </Link>
          </div>
        </section>
        {pendingTextDumps.length ? (
          <p className="status">
            {t("today.pendingDumps", { count: pendingTextDumps.length })}
          </p>
        ) : null}
        {isLoading ? <p className="muted">{t("common.loading")}</p> : null}
        {error ? (
          <button className="button secondary" type="button" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        ) : null}
        {data && data.length === 0 ? (
          <p className="muted">{t("today.empty")}</p>
        ) : null}
        <div className="task-list">
          {data?.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      </section>
    </main>
  );
}
