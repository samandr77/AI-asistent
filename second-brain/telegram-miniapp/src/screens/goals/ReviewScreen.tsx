import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Icon } from "../tasks/components/Icon";
import {
  getWeeklyDraft,
  listWeeklyReviews,
  upsertWeeklyReview,
} from "../../services/api";
import { GoalsBody, GoalsScreenLayout, GoalsTopBar } from "./components/shell";

function isoWeekStart(reference = new Date()): string {
  const date = new Date(reference);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function ReviewScreen() {
  const queryClient = useQueryClient();
  const [weekStart] = useState<string>(isoWeekStart());

  const draft = useQuery({
    queryKey: ["reviews", "draft", weekStart],
    queryFn: () => getWeeklyDraft(weekStart),
  });

  const history = useQuery({
    queryKey: ["reviews", "list"],
    queryFn: () => listWeeklyReviews(6),
  });

  const [highlights, setHighlights] = useState("");
  const [lessons, setLessons] = useState("");
  const [nextWeek, setNextWeek] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertWeeklyReview({
        week_start: weekStart,
        highlights: highlights.trim() || undefined,
        lessons: lessons.trim() || undefined,
        next_week_focus: nextWeek.trim() || undefined,
        mood: mood ?? undefined,
        energy: energy ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  return (
    <GoalsScreenLayout>
      <GoalsTopBar
        back="/goals"
        title="Ревью недели"
        eyebrow={`Неделя с ${weekStart}`}
      />
      <GoalsBody>
        <section className="g-ai-chip">
          <div className="g-ai-dot">AI</div>
          <div style={{ flex: 1 }}>
            Подведи неделю — это закрывает гештальт и заряжает следующую.
          </div>
          <Icon name="sparkle" size={14} color="#6E5BF6" />
        </section>

        {draft.isLoading ? (
          <p className="g-empty">Считаем итоги недели…</p>
        ) : null}

        {draft.data ? (
          <div className="g-form-card">
            <div className="g-review-meta">
              <div className="g-review-meta__cell">
                <div className="g-review-meta__cell-v">
                  {draft.data.completed_tasks_count}
                </div>
                <div className="g-review-meta__cell-l">Сделано</div>
              </div>
              <div className="g-review-meta__cell">
                <div className="g-review-meta__cell-v">
                  {draft.data.carried_over_count}
                </div>
                <div className="g-review-meta__cell-l">Перенесено</div>
              </div>
              <div className="g-review-meta__cell">
                <div className="g-review-meta__cell-v">
                  {draft.data.active_goals}
                </div>
                <div className="g-review-meta__cell-l">Активны</div>
              </div>
            </div>

            {draft.data.okr_progress.length > 0 ? (
              <>
                <div className="g-field__label" style={{ marginBottom: 4 }}>
                  OKR прогресс
                </div>
                {draft.data.okr_progress.map((item) => (
                  <div key={item.goal_id} className="g-kr">
                    <div className="g-kr__title">
                      <span className="g-kr__title-l">{item.title}</span>
                      <span className="g-kpi__value-num">
                        {item.computed_progress}%
                      </span>
                    </div>
                    <div className="g-kr__bar">
                      <i style={{ width: `${item.computed_progress}%` }} />
                    </div>
                    <div className="g-kr__metric">
                      KR{" "}
                      <b>
                        {item.key_results_done}/{item.key_results_total}
                      </b>
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            {draft.data.top_completed.length > 0 ? (
              <>
                <div className="g-field__label">Топ выполненных задач</div>
                <div>
                  {draft.data.top_completed.map((t) => (
                    <div key={t.id} className="g-review-task">
                      ✓ {t.title}
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {draft.data.suggestions.length > 0 ? (
              <div className="g-ai-chip" style={{ marginTop: 4 }}>
                <div className="g-ai-dot">AI</div>
                <div style={{ flex: 1 }}>
                  {draft.data.suggestions.join(" · ")}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="g-form-card">
          <div className="g-field">
            <label className="g-field__label" htmlFor="rev-highlights">
              Главные выигрыши недели
            </label>
            <textarea
              id="rev-highlights"
              className="g-field__textarea"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
            />
          </div>
          <div className="g-field">
            <label className="g-field__label" htmlFor="rev-lessons">
              Уроки
            </label>
            <textarea
              id="rev-lessons"
              className="g-field__textarea"
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
            />
          </div>
          <div className="g-field">
            <label className="g-field__label" htmlFor="rev-next">
              Фокус следующей недели
            </label>
            <textarea
              id="rev-next"
              className="g-field__textarea"
              value={nextWeek}
              onChange={(e) => setNextWeek(e.target.value)}
            />
          </div>
          <div className="g-field__row">
            <div className="g-field">
              <span className="g-field__label">Настроение</span>
              <div className="g-mood-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`g-mood-row__btn ${mood === n ? "active" : ""}`}
                    onClick={() => setMood(n)}
                    aria-label={`Настроение ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="g-field">
              <span className="g-field__label">Энергия</span>
              <div className="g-mood-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`g-mood-row__btn ${energy === n ? "active" : ""}`}
                    onClick={() => setEnergy(n)}
                    aria-label={`Энергия ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="g-btn primary lg g-btn--full"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Сохраняем…" : "Сохранить ревью"}
          </button>
        </div>

        {(history.data?.length ?? 0) > 0 ? (
          <>
            <div className="g-section-title">
              <span>История ревью</span>
              <span className="g-section-title__count">
                {history.data?.length}
              </span>
            </div>
            {history.data!.map((r) => (
              <div key={r.id} className="g-form-card">
                <div className="g-field__label">{r.week_start}</div>
                <div style={{ fontSize: 13, color: "#3A2F70" }}>
                  Сделано {r.completed_tasks_count} · Перенесено{" "}
                  {r.carried_over_count}
                </div>
                {r.highlights ? (
                  <p style={{ margin: 0, color: "#1A1340", fontSize: 13 }}>
                    {r.highlights}
                  </p>
                ) : null}
              </div>
            ))}
          </>
        ) : null}
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
