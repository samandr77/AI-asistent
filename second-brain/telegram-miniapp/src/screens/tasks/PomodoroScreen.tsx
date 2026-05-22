import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  createFocusSession,
  getAllTasks,
  getFocusSettings,
  getFocusSummary,
} from "../../services/api";
import { Icon } from "./components/Icon";
import {
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SPHERES,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

export function PomodoroScreen() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["tasks", "focus-settings"],
    queryFn: getFocusSettings,
  });
  const summaryQuery = useQuery({
    queryKey: ["tasks", "focus-summary"],
    queryFn: () => getFocusSummary(),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "active", "focus"],
    queryFn: () => getAllTasks({ limit: 50 }),
  });
  const settings = settingsQuery.data;
  const sessionSeconds = (settings?.pomodoro_min ?? 25) * 60;
  const totalSessions = settings?.sessions_before_long_break ?? 4;
  const currentTask = tasksQuery.data?.find((task) => !task.is_done);
  const [remaining, setRemaining] = useState(sessionSeconds);
  const [running, setRunning] = useState(false);
  const [sessionIdx, setSessionIdx] = useState(1);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const finishMutation = useMutation({
    mutationFn: () => {
      if (!currentTask) return Promise.resolve({});
      const durationMin = Math.max(1, Math.round((sessionSeconds - remaining) / 60));
      return createFocusSession(currentTask.id, {
        started_at: startedAt ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_min: durationMin,
        mode: "pomodoro",
        completed: true,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "focus-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  useEffect(() => {
    setRemaining(sessionSeconds);
  }, [sessionSeconds]);

  useEffect(() => {
    if (!running) return;
    if (!startedAt) setStartedAt(new Date().toISOString());
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const R = 96;
  const C = 2 * Math.PI * R;
  const progress = remaining / sessionSeconds;

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <TasksApp>
      <Screen className="bg-deep">
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <>
              <span
                className="pill"
                style={{
                  background: "#fff",
                  color: "var(--ink-700)",
                  boxShadow: "var(--sh-1)",
                }}
              >
                <Icon name="moon" size={11} color="var(--ink-700)" /> DND
              </span>
              <IconBtn name="more" variant="on-card" ariaLabel="Ещё" />
            </>
          }
          eyebrow={`Pomodoro · ${settings?.pomodoro_min ?? 25} / ${settings?.short_break_min ?? 5}`}
          title="Фокус-сессия"
          subtitle={`Помодоро ${sessionIdx} из ${totalSessions} · ${settings?.dnd_enabled ? "DND включен" : "обычный режим"}`}
        />
        <ScreenBody style={{ alignItems: "center", paddingTop: 6 }}>
          <div className="card pomo-task" style={{ alignSelf: "stretch" }}>
            <div
              className="stripe"
              style={{ background: SPHERES.work.color }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-400)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Сейчас фокус на
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                  marginTop: 2,
                }}
              >
                {currentTask?.title ?? "Без задачи — выберите из списка"}
              </div>
            </div>
            <span className="pill focus">Deep Work</span>
          </div>

          <div className="pomo-timer">
            <svg width="260" height="260" viewBox="0 0 260 260">
              <circle
                cx="130"
                cy="130"
                r={R}
                fill="none"
                stroke="rgba(46,91,255,0.10)"
                strokeWidth="14"
              />
              <circle
                cx="130"
                cy="130"
                r={R}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${C * progress} ${C}`}
                transform="rotate(-90 130 130)"
              />
              {Array.from({ length: 60 }).map((_, i) => (
                <line
                  key={i}
                  x1={130 + Math.cos((i * Math.PI) / 30 - Math.PI / 2) * 76}
                  y1={130 + Math.sin((i * Math.PI) / 30 - Math.PI / 2) * 76}
                  x2={130 + Math.cos((i * Math.PI) / 30 - Math.PI / 2) * 80}
                  y2={130 + Math.sin((i * Math.PI) / 30 - Math.PI / 2) * 80}
                  stroke={i % 5 === 0 ? "var(--ink-400)" : "var(--ink-200)"}
                  strokeWidth={i % 5 === 0 ? 1.5 : 1}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="center">
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-400)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Осталось
              </div>
              <div className="time">
                {mm}:{ss}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-500)",
                  fontWeight: 600,
                  marginTop: 6,
                }}
              >
                из {Math.floor(sessionSeconds / 60)}:00 · сессия {sessionIdx} / {totalSessions}
              </div>
            </div>
          </div>

          <div className="pomo-dots">
            {Array.from({ length: totalSessions }).map((_, i) => (
              <div key={i} className={`d${i < sessionIdx ? " on" : ""}`} />
            ))}
          </div>

          <div className="pomo-controls">
            <button
              type="button"
              className="icon-btn side-btn"
              onClick={() => setSessionIdx((s) => Math.max(1, s - 1))}
              aria-label="Предыдущая сессия"
            >
              <Icon name="chevron-left" size={18} color="var(--ink-700)" />
            </button>
            <button
              type="button"
              className="play-btn"
              onClick={() => {
                if (running) {
                  setRunning(false);
                  finishMutation.mutate();
                } else {
                  setRunning(true);
                }
              }}
              aria-label={running ? "Пауза" : "Старт"}
            >
              <Icon
                name={running ? "pause" : "play"}
                size={26}
                color="#fff"
                strokeWidth={2.2}
              />
            </button>
            <button
              type="button"
              className="icon-btn side-btn"
              onClick={() =>
                setSessionIdx((s) => Math.min(totalSessions, s + 1))
              }
              aria-label="Следующая сессия"
            >
              <Icon name="chevron" size={18} color="var(--ink-700)" />
            </button>
          </div>

          <div
            style={{
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 6,
            }}
          >
            <div
              className="card flat"
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: "var(--success-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="coffee" size={16} color="var(--success)" />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-400)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Дальше
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink-900)",
                    marginTop: 2,
                  }}
                >
                  Короткий перерыв · {settings?.short_break_min ?? 5} мин
                </div>
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
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ink-900)",
                  }}
                >
                  Фокус за сегодня
                </div>
                <span className="pill ghost">статистика</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                {[
                  { v: `${summaryQuery.data?.focus_minutes ?? 0}м`, l: "в фокусе" },
                  { v: `${summaryQuery.data?.completed_count ?? 0}`, l: "сессии" },
                  { v: "—", l: "без отвлечений" },
                ].map((x) => (
                  <div key={x.l} style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--ink-900)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {x.v}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-500)",
                        fontWeight: 600,
                        marginTop: 1,
                      }}
                    >
                      {x.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScreenBody>
        <TabBar active="focus" />
      </Screen>
    </TasksApp>
  );
}
