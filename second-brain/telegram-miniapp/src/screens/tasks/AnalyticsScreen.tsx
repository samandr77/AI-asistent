import { useState } from "react";

import {
  AIChip,
  BackBtn,
  Screen,
  ScreenBody,
  SPHERES,
  TabBar,
  TasksApp,
  TopBar,
  type TaskSphere,
} from "./components/shell";

interface DayStat {
  d: string;
  v: number;
}

const WEEK: DayStat[] = [
  { d: "ПН", v: 0 },
  { d: "ВТ", v: 0 },
  { d: "СР", v: 0 },
  { d: "ЧТ", v: 0 },
  { d: "ПТ", v: 0 },
  { d: "СБ", v: 0 },
  { d: "ВС", v: 0 },
];

const ESTIMATES: { type: string; est: number; real: number; count: number }[] =
  [];

const SPHERE_HOURS: { k: TaskSphere; v: number; label: string }[] = [];

export function AnalyticsScreen() {
  const [range, setRange] = useState<"week" | "month">("month");

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
          eyebrow="Текущая неделя"
          title="Аналитика и инсайты"
          subtitle="Кто измеряет — тот достигает"
        />
        <ScreenBody>
          <AIChip
            text={<>Данных пока недостаточно — закройте несколько задач.</>}
            cta={null}
          />

          <div className="hero-dark">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="lbl">Выполнено за неделю</div>
                <div className="big">
                  0
                  <span
                    style={{
                      fontSize: 22,
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                    }}
                  >
                    {" "}
                    / 0
                  </span>
                </div>
                <div className="sub">—</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lbl">Карма</div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    marginTop: 4,
                    color: "var(--accent)",
                  }}
                >
                  0
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  Новичок
                </div>
              </div>
            </div>

            <div className="week-bars">
              {WEEK.map((d) => (
                <div
                  key={d.d}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div className="wbar">
                    <div
                      className="fill"
                      style={{
                        height: `${d.v * 100}%`,
                        background: d.v < 0.5 ? "var(--warn)" : "var(--accent)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {d.d}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--ink-900)",
              }}
            >
              Оценка vs реальность
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-500)",
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              Planning fallacy · Kahneman
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 12,
              }}
            >
              {ESTIMATES.map((row) => {
                const over = row.real > row.est;
                return (
                  <div key={row.type}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "var(--ink-700)",
                      }}
                    >
                      <span>
                        {row.type}{" "}
                        <span style={{ color: "var(--ink-400)" }}>
                          · ×{row.count}
                        </span>
                      </span>
                      <span
                        style={{
                          color: over ? "var(--warn)" : "var(--success)",
                          fontWeight: 700,
                        }}
                      >
                        {over ? "+" : ""}
                        {row.real - row.est} мин
                      </span>
                    </div>
                    <div className="est-bar">
                      <i
                        style={{
                          width: `${(row.est / 130) * 100}%`,
                          background: "var(--ink-300)",
                        }}
                      />
                      <i
                        style={{
                          width: `${(row.real / 130) * 100}%`,
                          background: over ? "var(--warn)" : "var(--success)",
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 10,
                fontSize: 10.5,
                color: "var(--ink-500)",
                fontWeight: 600,
              }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--ink-300)",
                  }}
                />{" "}
                Оценка
              </span>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--warn)",
                  }}
                />{" "}
                Реальность
              </span>
            </div>
          </div>

          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                }}
              >
                По сферам
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-400)",
                  fontWeight: 600,
                }}
              >
                часов в неделю
              </span>
            </div>
            <div
              style={{
                display: "flex",
                height: 12,
                borderRadius: 999,
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              {SPHERE_HOURS.map((s) => (
                <div
                  key={s.k}
                  style={{ flex: s.v, background: SPHERES[s.k].color }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 12,
              }}
            >
              {SPHERE_HOURS.map((s) => (
                <div
                  key={s.k}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: SPHERES[s.k].color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--ink-700)",
                    }}
                  >
                    {SPHERES[s.k].label}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-900)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                className="ai-dot"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  background: "linear-gradient(135deg, var(--accent), #0ea5e9)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                AI
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                }}
              >
                Совет недели
              </div>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-700)",
                lineHeight: 1.45,
              }}
            >
              AI пришлёт совет, когда наберётся достаточно данных по вашим
              задачам.
            </div>
            <button
              type="button"
              className="btn primary tiny"
              style={{ marginTop: 10 }}
            >
              Применить план
            </button>
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
