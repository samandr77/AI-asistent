import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  createReflection,
  getTodaySummary,
  updateReflection,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";

export function TodayReflectionScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addReflection = useAppStore((state) => state.addReflection);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  const tzOffset = -new Date().getTimezoneOffset();
  const targetDate = searchParams.get("date") ?? undefined;
  const summaryQuery = useQuery({
    queryKey: ["reflections", "today", tzOffset, targetDate],
    queryFn: () => getTodaySummary({ tzOffset, date: targetDate }),
  });

  useEffect(() => {
    const existing = summaryQuery.data?.existing_reflection;
    if (existing) {
      setMood(existing.mood);
      setEnergy(existing.energy);
      setNotes(existing.notes ?? "");
    }
  }, [summaryQuery.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const existing = summaryQuery.data?.existing_reflection;
      const body = {
        mood,
        energy,
        notes: notes.trim() || undefined,
      };
      return existing
        ? updateReflection(existing.id, body)
        : createReflection({ ...body, date: targetDate });
    },
    onSuccess: (reflection) => {
      addReflection(reflection);
      navigate("/reflections", { replace: true });
    },
  });

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>
          {targetDate
            ? t("reflection.forDate", { date: targetDate })
            : t("screens.todayReflection")}
        </h1>
        {summaryQuery.data ? (
          <div className="status">
            <strong>{t("reflection.summary")}</strong>
            <p className="muted">
              {t("reflection.summaryCounts", {
                completed: summaryQuery.data.completed_tasks.length,
                aligned: summaryQuery.data.goal_aligned_tasks.length,
                dumps: summaryQuery.data.total_dumps,
              })}
            </p>
          </div>
        ) : null}
        <label className="field">
          <span>{t("reflection.mood")}: {mood}</span>
          <input min={1} max={5} type="range" value={mood} onChange={(event) => setMood(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>{t("reflection.energy")}: {energy}</span>
          <input min={1} max={5} type="range" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>{t("reflection.notes")}</span>
          <textarea
            className="dump-input small"
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          className="button"
          disabled={mutation.isPending || notes.length > 4000}
          type="button"
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("common.loading") : t("common.save")}
        </button>
      </section>
    </main>
  );
}
