import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { deleteTask, getAllTasks, updateTask } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Task } from "../../types/api";

interface TaskDetailState {
  task?: Task;
}

export function TaskDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams();
  const state = location.state as TaskDetailState | null;
  const removeTaskFromStore = useAppStore((store) => store.removeTaskFromStore);
  const updateTaskInStore = useAppStore((store) => store.updateTaskInStore);
  const [title, setTitle] = useState(state?.task?.title ?? "");

  const { data } = useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => getAllTasks({ limit: 100 }),
    enabled: !state?.task,
  });

  const task =
    state?.task ?? data?.find((candidate) => candidate.id === taskId) ?? null;

  useEffect(() => {
    if (task && !title) {
      setTitle(task.title);
    }
  }, [task, title]);

  const saveMutation = useMutation({
    mutationFn: () => updateTask(taskId ?? "", { title }),
    onSuccess: (updated) => updateTaskInStore(updated.id, updated),
  });
  const doneMutation = useMutation({
    mutationFn: () => updateTask(taskId ?? "", { is_done: true }),
    onSuccess: (updated) => {
      updateTaskInStore(updated.id, updated);
      navigate("/tasks");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId ?? ""),
    onSuccess: () => {
      if (taskId) removeTaskFromStore(taskId);
      navigate("/tasks", { replace: true });
    },
  });

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.taskDetail")}</h1>
        {!task ? (
          <p className="muted">{t("tasks.notFound")}</p>
        ) : (
          <>
            <label className="field">
              <span>{t("tasks.title")}</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            {task.notes ? <p className="status">{task.notes}</p> : null}
            <div className="action-row">
              <button
                className="button"
                disabled={!title.trim() || saveMutation.isPending}
                type="button"
                onClick={() => saveMutation.mutate()}
              >
                {t("common.save")}
              </button>
              <button
                className="button secondary"
                disabled={doneMutation.isPending}
                type="button"
                onClick={() => doneMutation.mutate()}
              >
                {t("tasks.markDone")}
              </button>
              <button
                className="button danger"
                disabled={deleteMutation.isPending}
                type="button"
                onClick={() => deleteMutation.mutate()}
              >
                {t("common.delete")}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
