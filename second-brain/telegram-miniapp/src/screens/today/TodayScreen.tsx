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
        </nav>
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
