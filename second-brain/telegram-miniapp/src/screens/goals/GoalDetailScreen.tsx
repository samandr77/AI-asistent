import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Icon } from "../tasks/components/Icon";
import {
  createKeyResult,
  deleteGoal,
  deleteKeyResult,
  getGoal,
  getGoalProgress,
  getGoalTasks,
  listKeyResults,
  updateGoal,
  updateKeyResult,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Goal, KeyResult, KeyResultDirection } from "../../types/api";
import {
  GoalsBody,
  GoalsScreenLayout,
  GoalsTopBar,
  levelColor,
  levelLabel,
  statusLabel,
} from "./components/shell";

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
  const queryClient = useQueryClient();
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
  const krQuery = useQuery({
    queryKey: ["goals", "key-results", goalId],
    queryFn: () => listKeyResults(goalId ?? ""),
    enabled: Boolean(goalId),
  });

  const goal = state?.goal ?? goalQuery.data ?? null;
  useEffect(() => {
    if (goal && !title) setTitle(goal.title);
  }, [goal, title]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  }

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<Goal>) => updateGoal(goalId ?? "", updates),
    onSuccess: (updated) => {
      updateGoalInStore(updated.id, updated);
      invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(goalId ?? ""),
    onSuccess: () => {
      if (goalId) removeGoalFromStore(goalId);
      invalidateAll();
      navigate("/goals", { replace: true });
    },
  });

  const createKrMutation = useMutation({
    mutationFn: (body: {
      title: string;
      target_value: number;
      current_value?: number;
      direction?: KeyResultDirection;
    }) => createKeyResult(goalId ?? "", body),
    onSuccess: () => invalidateAll(),
  });

  const updateKrMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<KeyResult>;
    }) => updateKeyResult(goalId ?? "", id, updates),
    onSuccess: () => invalidateAll(),
  });

  const deleteKrMutation = useMutation({
    mutationFn: (id: string) => deleteKeyResult(goalId ?? "", id),
    onSuccess: () => invalidateAll(),
  });

  const [newKrTitle, setNewKrTitle] = useState("");
  const [newKrTarget, setNewKrTarget] = useState<number | "">("");
  const [newKrDirection, setNewKrDirection] =
    useState<KeyResultDirection>("increase");

  const computed =
    progressQuery.data?.computed_progress ?? goal?.progress_percent ?? 0;
  const lc = levelColor(goal?.level ?? "year");

  return (
    <GoalsScreenLayout withTabBar={false}>
      <GoalsTopBar
        back="/goals"
        title={goal?.title ?? t("screens.goalDetail")}
        eyebrow={goal ? levelLabel(goal.level ?? "year") : ""}
      />

      <GoalsBody>
        {!goal ? (
          <p className="g-empty">{t("goals.notFound")}</p>
        ) : (
          <>
            <section
              className="g-hero"
              style={{ background: lc.tint, borderColor: `${lc.color}28` }}
            >
              <div className="g-hero__row">
                <div className="g-hero__icon">
                  <Icon
                    name="target"
                    size={18}
                    color={lc.color}
                    strokeWidth={2.2}
                  />
                </div>
                <div className="g-hero__title">
                  <strong>{goal.title}</strong>
                  <span style={{ color: lc.color }}>
                    {levelLabel(goal.level ?? "year")} ·{" "}
                    {t(`goals.status.${goal.status}`)}
                  </span>
                </div>
              </div>
              <div className="g-hero__big">
                <div>
                  <div className="g-hero__big-num">{computed}%</div>
                  <div className="g-hero__big-sub">
                    {progressQuery.data
                      ? t("goals.progressSummary", {
                          done: progressQuery.data.completed_tasks_count,
                          total: progressQuery.data.linked_tasks_count,
                        })
                      : "—"}
                  </div>
                </div>
                <div className="g-hero__ring" aria-hidden="true">
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="6"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke={lc.color}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(2 * Math.PI * 24 * computed) / 100} ${2 * Math.PI * 24}`}
                      transform="rotate(-90 30 30)"
                    />
                  </svg>
                  <div className="g-hero__ring-text">{computed}%</div>
                </div>
              </div>
            </section>

            {goal.description ? (
              <div className="g-form-card">
                <p style={{ margin: 0, color: "#3A2F70", lineHeight: 1.4 }}>
                  {goal.description}
                </p>
              </div>
            ) : null}

            <div className="g-form-card">
              <div className="g-field">
                <label className="g-field__label" htmlFor="goal-edit-title">
                  {t("goals.title")}
                </label>
                <input
                  id="goal-edit-title"
                  className="g-field__input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="g-field">
                <span className="g-field__label">Статус</span>
                <div
                  className="g-segmented"
                  role="tablist"
                  aria-label="Goal status"
                >
                  {statuses.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`g-segmented__btn ${goal.status === item ? "active" : ""}`}
                      onClick={() => saveMutation.mutate({ status: item })}
                    >
                      {t(`goals.status.${item}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="g-btn primary"
                  disabled={!title.trim() || saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ title: title.trim() })}
                >
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  className="g-btn danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm(t("common.delete") + "?")) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>

            {/* Ключевые результаты (Key Results) */}
            <div className="g-section-title">
              <span>Ключевые результаты</span>
              <span className="g-section-title__count">
                {krQuery.data?.length ?? 0}
              </span>
            </div>

            {(krQuery.data ?? []).map((kr) => (
              <div key={kr.id} className="g-kr">
                <div className="g-kr__title">
                  <span className="g-kr__title-l">{kr.title}</span>
                  <span className={`g-kr__status ${kr.status}`}>
                    {statusLabel(kr.status)}
                  </span>
                </div>
                <div className="g-kr__metric">
                  <b>{kr.current_value}</b> / <b>{kr.target_value}</b>{" "}
                  {kr.unit ?? ""} ·{" "}
                  {kr.direction === "decrease"
                    ? "↓"
                    : kr.direction === "maintain"
                      ? "≈"
                      : "↑"}
                </div>
                <div className="g-kr__bar">
                  <i style={{ width: `${kr.progress_percent}%` }} />
                </div>
                <div className="g-kr__edit">
                  <input
                    type="number"
                    aria-label={`KR ${kr.title} current value`}
                    defaultValue={kr.current_value}
                    onBlur={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val) && val !== kr.current_value) {
                        updateKrMutation.mutate({
                          id: kr.id,
                          updates: { current_value: val },
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="g-btn tiny ghost"
                    onClick={() => deleteKrMutation.mutate(kr.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}

            <div className="g-form-card">
              <div className="g-field">
                <label className="g-field__label" htmlFor="kr-title">
                  Новый ключевой результат
                </label>
                <input
                  id="kr-title"
                  className="g-field__input"
                  placeholder="Например: MRR $5k"
                  value={newKrTitle}
                  onChange={(e) => setNewKrTitle(e.target.value)}
                />
              </div>
              <div className="g-field__row">
                <div className="g-field">
                  <label className="g-field__label" htmlFor="kr-target">
                    Цель
                  </label>
                  <input
                    id="kr-target"
                    type="number"
                    className="g-field__input"
                    value={newKrTarget}
                    onChange={(e) =>
                      setNewKrTarget(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>
                <div className="g-field">
                  <label className="g-field__label" htmlFor="kr-direction">
                    Направление
                  </label>
                  <select
                    id="kr-direction"
                    className="g-field__select"
                    value={newKrDirection}
                    onChange={(e) =>
                      setNewKrDirection(e.target.value as KeyResultDirection)
                    }
                  >
                    <option value="increase">Увеличить ↑</option>
                    <option value="decrease">Уменьшить ↓</option>
                    <option value="maintain">Удерживать ≈</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="g-btn primary"
                disabled={
                  !newKrTitle.trim() ||
                  newKrTarget === "" ||
                  createKrMutation.isPending
                }
                onClick={() => {
                  if (!newKrTitle.trim() || newKrTarget === "") return;
                  createKrMutation.mutate({
                    title: newKrTitle.trim(),
                    target_value: Number(newKrTarget),
                    direction: newKrDirection,
                  });
                  setNewKrTitle("");
                  setNewKrTarget("");
                  setNewKrDirection("increase");
                }}
              >
                Добавить результат
              </button>
            </div>

            {/* Linked tasks */}
            <div className="g-section-title">
              <span>{t("goals.linkedTasks")}</span>
              <span className="g-section-title__count">
                {tasksQuery.data?.length ?? 0}
              </span>
            </div>

            {tasksQuery.data?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasksQuery.data.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#fff",
                      boxShadow: "var(--g-sh-1)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 6,
                        border: task.is_done
                          ? "1.5px solid #6E5BF6"
                          : "1.5px solid #B0BCD2",
                        background: task.is_done ? "#6E5BF6" : "#fff",
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: task.is_done ? "#9D94C3" : "#1A1340",
                          textDecoration: task.is_done
                            ? "line-through"
                            : "none",
                        }}
                      >
                        {task.title}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="g-empty">{t("goals.noLinkedTasks")}</p>
            )}

            <Link to="/goals" className="g-btn ghost g-btn--full">
              {t("common.back")}
            </Link>
          </>
        )}
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
