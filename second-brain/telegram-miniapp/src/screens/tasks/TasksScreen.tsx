import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SphereFilter } from "../../components/SphereFilter";
import { TaskCard } from "../../components/TaskCard";
import { getAllTasks } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Sphere } from "../../types/api";

export function TasksScreen() {
  const { t } = useTranslation();
  const [sphere, setSphere] = useState<Sphere | "all">("all");
  const setAllTasks = useAppStore((state) => state.setAllTasks);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tasks", sphere],
    queryFn: () =>
      getAllTasks({
        sphere: sphere === "all" ? undefined : sphere,
      }),
  });

  useEffect(() => {
    if (data) {
      setAllTasks(data);
    }
  }, [data, setAllTasks]);

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.tasks")}</h1>
        <p className="status">{t("tasks.cutoff")}</p>
        <SphereFilter value={sphere} onChange={setSphere} />
        {isLoading ? <p className="muted">{t("common.loading")}</p> : null}
        {error ? (
          <button className="button secondary" type="button" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        ) : null}
        {data && data.length === 0 ? (
          <p className="muted">{t("tasks.empty")}</p>
        ) : null}
        <div className="task-list">
          {data?.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      </section>
    </main>
  );
}
