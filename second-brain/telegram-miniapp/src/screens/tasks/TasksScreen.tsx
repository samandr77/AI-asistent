import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { SphereFilter } from "../../components/SphereFilter";
import { TaskCard } from "../../components/TaskCard";
import { createTask, getAllTasks, getInboxTasks } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Sphere } from "../../types/api";

export function TasksScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [sphere, setSphere] = useState<Sphere | "all">("all");
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const setAllTasks = useAppStore((state) => state.setAllTasks);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tasks", sphere],
    queryFn: () =>
      getAllTasks({
        sphere: sphere === "all" ? undefined : sphere,
      }),
  });

  const inboxQuery = useQuery({
    queryKey: ["tasks", "inbox"],
    queryFn: () => getInboxTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      createTask({ title, raw_text: title, status: "inbox" }),
    onSuccess: () => {
      setQuickAdd("");
      setQuickAddError(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      setQuickAddError(t("tasks.quickAdd.error"));
    },
  });

  useEffect(() => {
    if (data) {
      setAllTasks(data);
    }
  }, [data, setAllTasks]);

  const inboxCount = inboxQuery.data?.length ?? 0;
  const trimmed = quickAdd.trim();

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    setQuickAddError(null);
    createMutation.mutate(trimmed);
  }

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.tasks")}</h1>

        <form className="task-quick-add" onSubmit={handleQuickAdd}>
          <input
            type="text"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            placeholder={t("tasks.quickAdd.placeholder")}
            aria-label={t("tasks.quickAdd.placeholder")}
            disabled={createMutation.isPending}
          />
          <button
            className="button"
            type="submit"
            disabled={!trimmed || createMutation.isPending}
          >
            {t("tasks.quickAdd.submit")}
          </button>
        </form>
        {quickAddError ? <p className="error-text">{quickAddError}</p> : null}

        <Link className="button secondary" to="/tasks/inbox">
          {t("tasks.inbox.open")}
          {inboxCount > 0 ? ` (${inboxCount})` : ""}
        </Link>

        <SphereFilter value={sphere} onChange={setSphere} />
        {isLoading ? <p className="muted">{t("common.loading")}</p> : null}
        {error ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </button>
        ) : null}
        {data && data.length === 0 ? (
          <p className="muted">{t("tasks.empty")}</p>
        ) : null}
        <div className="task-list">
          {data?.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </main>
  );
}
