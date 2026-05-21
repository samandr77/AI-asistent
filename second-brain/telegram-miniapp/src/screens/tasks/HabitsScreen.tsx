import { Icon } from "./components/Icon";
import {
  AIChip,
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SPHERES,
  SphereChip,
  TabBar,
  TasksApp,
  TopBar,
  type TaskSphere,
} from "./components/shell";

interface Habit {
  name: string;
  sphere: TaskSphere;
  streak: number;
  today: boolean;
  done: boolean;
  recur?: string;
  chain: number[];
}

const HABITS: Habit[] = [];

const WEEK = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const WEEK_VALUES = [0, 0, 0, 0, 0, 0, 0];
const TODAY_IDX = (new Date().getDay() + 6) % 7;

export function HabitsScreen() {
  const todayHabits = HABITS.filter((h) => h.today);
  const doneToday = todayHabits.filter((h) => h.done).length;

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <IconBtn name="plus" variant="on-card" ariaLabel="Новая привычка" />
          }
          eyebrow="Phillippa Lally · 66 дней до привычки"
          title="Привычки и ритуалы"
          subtitle="Не рви цепь — Jerry Seinfeld method"
        />
        <ScreenBody>
          <AIChip
            text={
              <>Добавьте первую привычку — AI поможет настроить напоминания.</>
            }
            cta={null}
          />

          <div className="scr-section-title">
            <span>Сегодня</span>
            <span className="count">
              {doneToday} из {todayHabits.length} выполнено
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todayHabits.map((h) => (
              <div
                key={h.name}
                className="card"
                style={{
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    className={`check${h.done ? " done" : ""}`}
                    style={{ width: 22, height: 22, borderRadius: 8 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "var(--ink-900)",
                        textDecoration: h.done ? "line-through" : "none",
                        opacity: h.done ? 0.55 : 1,
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 4,
                        alignItems: "center",
                      }}
                    >
                      <SphereChip sphere={h.sphere} />
                      <span
                        className="chip"
                        style={{
                          background: "transparent",
                          color: "var(--ink-500)",
                          padding: 0,
                        }}
                      >
                        <Icon
                          name="repeat"
                          size={10}
                          color="var(--ink-500)"
                          strokeWidth={2}
                        />{" "}
                        каждый день
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 13,
                        fontWeight: 700,
                        color:
                          h.streak >= 14 ? "var(--warn)" : "var(--ink-700)",
                      }}
                    >
                      <Icon
                        name="fire"
                        size={13}
                        color={
                          h.streak >= 14 ? "var(--warn)" : "var(--ink-500)"
                        }
                        strokeWidth={2.2}
                      />
                      {h.streak}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: "var(--ink-400)",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      ДНЕЙ
                    </div>
                  </div>
                </div>

                <div>
                  <div className="habit-chain">
                    {h.chain.map((d, i) => (
                      <div
                        key={i}
                        className={`cell${d ? " on" : ""}`}
                        style={
                          d
                            ? {
                                background:
                                  i === h.chain.length - 1 && h.done
                                    ? "var(--accent)"
                                    : `${SPHERES[h.sphere].color}99`,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 9.5,
                      color: "var(--ink-400)",
                      fontWeight: 600,
                    }}
                  >
                    <span>4 недели назад</span>
                    <span>сегодня</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                }}
              >
                Эта неделя
              </div>
              <span className="pill ghost">0%</span>
            </div>
            <div className="week-grid">
              {WEEK.map((d, i) => {
                const val = WEEK_VALUES[i];
                const isToday = i === TODAY_IDX;
                return (
                  <div key={d} className="col">
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: isToday ? "var(--accent)" : "var(--ink-400)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {d}
                    </div>
                    <div className={`bar-wrap${isToday ? " today" : ""}`}>
                      <div
                        className="fill"
                        style={{
                          height: `${val * 100}%`,
                          background: isToday
                            ? "var(--accent)"
                            : SPHERES.health.color,
                          opacity: isToday ? 1 : 0.55,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {todayHabits.length === 0 ? (
            <div className="empty-state">
              Пока нет привычек. Добавьте первую — кнопка «+» справа сверху.
            </div>
          ) : null}
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
