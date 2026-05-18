import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ProgressBar } from "../../components/ProgressBar";
import { TaskCard } from "../../components/TaskCard";
import {
  deleteGoal,
  getGoal,
  getGoalProgress,
  getGoalTasks,
  updateGoal,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Goal } from "../../types/api";

interface GoalDetailState {
  goal?: Goal;
}

const statuses: Goal["status"][] = ["active", "paused", "achieved", "archived"];

export function GoalDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { goalId } = useParams();
  const state = location.state as GoalDetailState | null;
  const updateGoalInStore = useAppStore((store) => store.updateGoalInStore);
  const removeGoalFromStore = useAppStore((store) => store.removeGoalFromStore);
  const [title, setTitle] = useState(state?.goal?.title ?? "");

  const goalQuery = useQuery({
    queryKey: ["goals", "detail", goalId],
    queryFn: () => getGoal(goalId ?? ""),
    enabled: !state?.goal && Boolean(goalId),
  });
  const tasksQuery = useQuery({
    queryKey: ["goals", "tasks", goalId],
    queryFn: () => getGoalTasks(goalId ?? ""),
    enabled: Boolean(goalId),
  });
  const progressQuery = useQuery({
    queryKey: ["goals", "progress", goalId],
    queryFn: () => getGoalProgress(goalId ?? ""),
    enabled: Boolean(goalId),
  });

  const goal = state?.goal ?? goalQuery.data ?? null;
  useEffect(() => {
    if (goal && !title) setTitle(goal.title);
  }, [goal, title]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<Goal>) => updateGoal(goalId ?? "", updates),
    onSuccess: (updated) => {
      updateGoalInStore(updated.id, updated);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(goalId ?? ""),
    onSuccess: () => {
      if (goalId) removeGoalFromStore(goalId);
      navigate("/goals", { replace: true });
    },
  });

  const progress =
    progressQuery.data?.computed_progress ?? goal?.progress_percent ?? 0;

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.goalDetail")}</h1>
        {!goal ? (
          <p className="muted">{t("goals.notFound")}</p>
        ) : (
          <>
            <label className="field">
              <span>{t("goals.title")}</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            {goal.description ? <p className="status">{goal.description}</p> : null}
            <ProgressBar value={progress} />
            {progressQuery.data ? (
              <p className="muted">
                {t("goals.progressSummary", {
                  done: progressQuery.data.completed_tasks_count,
                  total: progressQuery.data.linked_tasks_count,
                })}
              </p>
            ) : null}
            <div className="segmented" role="tablist" aria-label="Goal status">
              {statuses.map((item) => (
                <button
                  className={goal.status === item ? "active" : ""}
                  key={item}
                  type="button"
                  onClick={() => saveMutation.mutate({ status: item })}
                >
                  {t(`goals.status.${item}`)}
                </button>
              ))}
            </div>
            <div className="action-row">
              <button
                className="button"
                disabled={!title.trim() || saveMutation.isPending}
                type="button"
                onClick={() => saveMutation.mutate({ title: title.trim() })}
              >
                {t("common.save")}
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
            <h2 className="section-title">{t("goals.linkedTasks")}</h2>
            {tasksQuery.data?.length ? (
              <div className="task-list">
                {tasksQuery.data.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <p className="muted">{t("goals.noLinkedTasks")}</p>
            )}
            <Link className="button secondary" to="/goals">
              {t("common.back")}
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
