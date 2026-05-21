import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SPHERES } from "../../constants/spheres";
import { createGoal, listGoals } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Goal, GoalLevel, Sphere } from "../../types/api";
import {
  GoalsBody,
  GoalsScreenLayout,
  GoalsTopBar,
  levelLabel,
} from "./components/shell";

const LEVELS: GoalLevel[] = ["life", "year", "quarter", "week"];

export function NewGoalScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addGoal = useAppStore((state) => state.addGoal);
  const [params] = useSearchParams();
  const initialParent = params.get("parent") ?? "";
  const initialLevel = (params.get("level") as GoalLevel | null) ?? "year";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [sphere, setSphere] = useState<Sphere | "">("mind");
  const [status, setStatus] = useState<Goal["status"]>("active");
  const [level, setLevel] = useState<GoalLevel>(initialLevel);
  const [parentGoalId, setParentGoalId] = useState(initialParent);
  const [weight, setWeight] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const parentCandidates = useQuery({
    queryKey: ["goals", "parent-candidates"],
    queryFn: async () => (await listGoals({ status: "active" })) ?? [],
  });

  const mutation = useMutation({
    mutationFn: createGoal,
    onSuccess: (goal) => {
      addGoal(goal);
      navigate(`/goals/${goal.id}`, { replace: true, state: { goal } });
    },
    onError: () => {
      setError(t("goals.createError"));
    },
  });

  function validate(): boolean {
    setError(null);
    if (!title.trim()) {
      setError(t("goals.titleRequired"));
      return false;
    }
    if (title.trim().length > 200) {
      setError(t("goals.titleTooLong"));
      return false;
    }
    if (targetDate) {
      const date = new Date(targetDate);
      const today = new Date(new Date().toDateString());
      if (Number.isNaN(date.getTime())) {
        setError(t("goals.dateInvalid"));
        return false;
      }
      if (date < today) {
        setError(t("goals.datePast"));
        return false;
      }
    }
    return true;
  }

  function submit() {
    if (!validate()) return;
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
      sphere: sphere || undefined,
      status,
      level,
      parent_goal_id: parentGoalId || null,
      weight,
    });
  }

  const titleLabel = t("goals.title");

  return (
    <GoalsScreenLayout withTabBar={false}>
      <GoalsTopBar
        back="/goals"
        title={t("screens.newGoal")}
        eyebrow={t("app.name")}
      />
      <GoalsBody>
        <div className="g-form-card">
          <div className="g-field">
            <label className="g-field__label" htmlFor="goal-title">
              {titleLabel}
            </label>
            <input
              id="goal-title"
              className="g-field__input"
              maxLength={200}
              value={title}
              aria-label={titleLabel}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Закрыть Q2 запуском MVP"
            />
          </div>

          <div className="g-field">
            <label className="g-field__label" htmlFor="goal-desc">
              {t("goals.description")}
            </label>
            <textarea
              id="goal-desc"
              className="g-field__textarea"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Зачем эта цель, какой ожидаемый результат?"
            />
          </div>

          <div className="g-field__row">
            <div className="g-field">
              <label className="g-field__label" htmlFor="goal-level">
                Уровень OKR
              </label>
              <select
                id="goal-level"
                className="g-field__select"
                value={level}
                onChange={(event) => setLevel(event.target.value as GoalLevel)}
              >
                {LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {levelLabel(lv)}
                  </option>
                ))}
              </select>
            </div>
            <div className="g-field">
              <label className="g-field__label" htmlFor="goal-weight">
                Вес (1–10)
              </label>
              <input
                id="goal-weight"
                className="g-field__input"
                type="number"
                min={1}
                max={10}
                value={weight}
                onChange={(event) =>
                  setWeight(
                    Math.max(1, Math.min(10, Number(event.target.value) || 1)),
                  )
                }
              />
            </div>
          </div>

          <div className="g-field">
            <label className="g-field__label" htmlFor="goal-parent">
              Родительская цель (опционально)
            </label>
            <select
              id="goal-parent"
              className="g-field__select"
              value={parentGoalId}
              onChange={(event) => setParentGoalId(event.target.value)}
            >
              <option value="">— нет —</option>
              {(parentCandidates.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {levelLabel(g.level ?? "year")} · {g.title}
                </option>
              ))}
            </select>
            <span className="g-field__hint">
              Привяжи квартальную цель к годовой — будет видно вклад в общее.
            </span>
          </div>

          <div className="g-field">
            <label className="g-field__label" htmlFor="goal-target">
              {t("goals.targetDate")}
            </label>
            <input
              id="goal-target"
              className="g-field__input"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>

          <div className="g-field">
            <span className="g-field__label">Сфера</span>
            <div
              className="g-segmented"
              role="tablist"
              aria-label="Goal sphere"
            >
              <button
                type="button"
                className={`g-segmented__btn ${sphere === "" ? "active" : ""}`}
                onClick={() => setSphere("")}
              >
                {t("common.all")}
              </button>
              {SPHERES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`g-segmented__btn ${sphere === item.id ? "active" : ""}`}
                  onClick={() => setSphere(item.id)}
                >
                  {item.id}
                </button>
              ))}
            </div>
          </div>

          <div className="g-field">
            <span className="g-field__label">Статус</span>
            <div
              className="g-segmented"
              role="tablist"
              aria-label="Goal status"
            >
              {(["active", "paused"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`g-segmented__btn ${status === item ? "active" : ""}`}
                  onClick={() => setStatus(item)}
                >
                  {t(`goals.status.${item}`)}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="g-field__error">{error}</p> : null}

          <button
            className="g-btn primary lg g-btn--full"
            disabled={mutation.isPending}
            type="button"
            onClick={submit}
          >
            {mutation.isPending ? t("common.loading") : t("goals.create")}
          </button>
        </div>
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
