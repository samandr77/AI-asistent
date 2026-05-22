import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getFocusSummary, getTaskAnalytics } from "../../services/api";
import {
  AIChip,
  BackBtn,
  Screen,
  ScreenBody,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

const WEEK = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

export function AnalyticsScreen() {
  const [range, setRange] = useState<"week" | "month">("month");
  const analyticsQuery = useQuery({
    queryKey: ["tasks", "analytics", range],
    queryFn: () => getTaskAnalytics(),
  });
  const focusQuery = useQuery({
    queryKey: ["tasks", "focus-summary", range],
    queryFn: () => getFocusSummary(),
  });
  const analytics = analyticsQuery.data;
  const focus = focusQuery.data;
  const byDay = focus?.by_day ?? {};
  const maxDay = Math.max(1, ...Object.values(byDay));

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <div className="seg" style={{ padding: 2, height: 30 }}>
              <button
                type="button"
                className={`s${range === "week" ? " active" : ""}`}
                style={{ padding: "4px 8px", fontSize: 11 }}
                onClick={() => setRange("week")}
              >
                Неделя
              </button>
              <button
                type="button"
                className={`s${range === "month" ? " active" : ""}`}
                style={{ padding: "4px 8px", fontSize: 11 }}
                onClick={() => setRange("month")}
              >
                Месяц
              </button>
            </div>
          }
          eyebrow="Текущая продуктивность"
          title="Аналитика и инсайты"
          subtitle="Задачи, фокус, сроки и привычки"
        />
        <ScreenBody>
          <AIChip
            text={
              analytics?.tasks_total
                ? <>AI сможет объяснять рекомендации по данным задач, фокуса и переносов.</>
                : <>Данных пока недостаточно — закройте несколько задач.</>
            }
            cta={null}
          />

          <div className="hero-dark">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="lbl">Выполнено</div>
                <div className="big">
                  {analytics?.completed_count ?? 0}
                  <span style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                    {" "}
                    / {analytics?.tasks_total ?? 0}
                  </span>
                </div>
                <div className="sub">
                  В фокусе: {analytics?.focus_minutes ?? focus?.focus_minutes ?? 0}м
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lbl">В срок</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "var(--accent)" }}>
                  {analytics?.on_time_rate === null || analytics?.on_time_rate === undefined
                    ? "—"
                    : `${Math.round(analytics.on_time_rate * 100)}%`}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>
                  переносов: {analytics?.rollover_count ?? 0}
                </div>
              </div>
            </div>

            <div className="week-bars">
              {WEEK.map((d, index) => {
                const key = Object.keys(byDay)[index];
                const value = key ? byDay[key] : 0;
                return (
                  <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div className="wbar">
                      <div
                        className="fill"
                        style={{
                          height: `${Math.max(4, (value / maxDay) * 100)}%`,
                          background: value === 0 ? "var(--ink-400)" : "var(--accent)",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}>
                      {d}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-900)" }}>
              Оценка vs реальность
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-500)", fontWeight: 500, marginTop: 2 }}>
              Средняя ошибка: {analytics?.estimate_error_avg_min ?? "нет данных"} мин
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-900)", marginBottom: 10 }}>
              По сферам
            </div>
            {Object.entries(analytics?.completed_by_sphere ?? {}).map(([sphere, count]) => (
              <div key={sphere} className="estimate-row">
                <span>{sphere}</span>
                <b>{count}</b>
              </div>
            ))}
            {Object.keys(analytics?.completed_by_sphere ?? {}).length === 0 ? (
              <div className="empty-state">Нет завершённых задач в выбранном периоде.</div>
            ) : null}
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
