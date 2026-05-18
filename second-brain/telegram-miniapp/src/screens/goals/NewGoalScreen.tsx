import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { SPHERES } from "../../constants/spheres";
import { createGoal } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Goal, Sphere } from "../../types/api";

export function NewGoalScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addGoal = useAppStore((state) => state.addGoal);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [sphere, setSphere] = useState<Sphere | "">("");
  const [status, setStatus] = useState<Goal["status"]>("active");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createGoal,
    onSuccess: (goal) => {
      addGoal(goal);
      navigate(`/goals/${goal.id}`, { replace: true, state: { goal } });
    },
    onError: (err: { status?: number }) => {
      if (err.status === 402) {
        navigate("/premium");
        return;
      }
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
    });
  }

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.newGoal")}</h1>
        <label className="field">
          <span>{t("goals.title")}</span>
          <input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("goals.description")}</span>
          <textarea
            className="dump-input small"
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("goals.targetDate")}</span>
          <input
            placeholder="2026-12-31"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>
        <div className="segmented" role="tablist" aria-label="Goal sphere">
          <button className={sphere === "" ? "active" : ""} type="button" onClick={() => setSphere("")}>
            {t("common.all")}
          </button>
          {SPHERES.map((item) => (
            <button
              className={sphere === item.id ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => setSphere(item.id)}
            >
              {item.id}
            </button>
          ))}
        </div>
        <div className="segmented" role="tablist" aria-label="Goal status">
          {(["active", "paused"] as const).map((item) => (
            <button
              className={status === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => setStatus(item)}
            >
              {t(`goals.status.${item}`)}
            </button>
          ))}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="button" disabled={mutation.isPending} type="button" onClick={submit}>
          {mutation.isPending ? t("common.loading") : t("goals.create")}
        </button>
      </section>
    </main>
  );
}
