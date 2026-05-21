import { useEffect, useState } from "react";

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

const SESSION_SECONDS = 25 * 60;
const TOTAL_SESSIONS = 4;

export function PomodoroScreen() {
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessionIdx, setSessionIdx] = useState(1);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const R = 96;
  const C = 2 * Math.PI * R;
  const progress = remaining / SESSION_SECONDS;

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
          eyebrow="Pomodoro · 25 / 5"
          title="Фокус-сессия"
          subtitle={`Помодоро ${sessionIdx} из ${TOTAL_SESSIONS} · уведомления отключены`}
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
                Без задачи — выберите из списка
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
                из 25:00 · сессия {sessionIdx} / {TOTAL_SESSIONS}
              </div>
            </div>
          </div>

          <div className="pomo-dots">
            {Array.from({ length: TOTAL_SESSIONS }).map((_, i) => (
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
              onClick={() => setRunning((r) => !r)}
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
                setSessionIdx((s) => Math.min(TOTAL_SESSIONS, s + 1))
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
                  Короткий перерыв · 5 мин
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
                <span className="pill ghost">
                  <Icon name="fire" size={11} color="var(--ink-500)" /> начать
                  стрик
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                {[
                  { v: "0м", l: "в фокусе" },
                  { v: "0", l: "сессии" },
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
