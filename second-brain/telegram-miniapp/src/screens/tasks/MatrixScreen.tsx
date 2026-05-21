import {
  AIChip,
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SPHERES,
  TabBar,
  TasksApp,
  TopBar,
  type TaskSphere,
} from "./components/shell";
import { Icon } from "./components/Icon";

interface Quad {
  id: string;
  title: string;
  sub: string;
  accent: string;
  tone: string;
  border: string;
  tasks: { name: string; meta: string; sphere: TaskSphere }[];
}

const QUADS: Quad[] = [
  {
    id: "q1",
    title: "Сделать сейчас",
    sub: "Срочно · Важно",
    accent: "var(--danger)",
    tone: "rgba(221,63,82,0.06)",
    border: "rgba(221,63,82,0.18)",
    tasks: [],
  },
  {
    id: "q2",
    title: "Запланировать",
    sub: "Важно · Несрочно",
    accent: "var(--accent)",
    tone: "rgba(46,91,255,0.06)",
    border: "rgba(46,91,255,0.18)",
    tasks: [],
  },
  {
    id: "q3",
    title: "Делегировать",
    sub: "Срочно · Неважно",
    accent: "var(--warn)",
    tone: "rgba(220,138,30,0.06)",
    border: "rgba(220,138,30,0.18)",
    tasks: [],
  },
  {
    id: "q4",
    title: "Удалить / отложить",
    sub: "Несрочно · Неважно",
    accent: "var(--ink-400)",
    tone: "var(--card-tint)",
    border: "var(--hairline)",
    tasks: [],
  },
];

const SUMMARY = [
  { l: "Сейчас", v: 0, c: "var(--danger)" },
  { l: "План", v: 0, c: "var(--accent)" },
  { l: "Делегир.", v: 0, c: "var(--warn)" },
  { l: "Отложить", v: 0, c: "var(--ink-400)" },
];

export function MatrixScreen() {
  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="more" variant="on-card" ariaLabel="Ещё" />}
          eyebrow="Метод Эйзенхауэра"
          title="Матрица приоритетов"
          subtitle="Перетащите задачу в нужный квадрант"
        />
        <ScreenBody>
          <AIChip
            text={
              <>
                Распределите задачи по квадрантам — AI поможет с приоритетами.
              </>
            }
            cta={null}
          />

          <div className="matrix-grid">
            {QUADS.map((q) => (
              <div
                key={q.id}
                className="quadrant"
                style={{ background: q.tone, borderColor: q.border }}
              >
                <div className="head">
                  <div className="sub" style={{ color: q.accent }}>
                    <span className="dot" style={{ background: q.accent }} />
                    {q.sub}
                  </div>
                  <div className="title">{q.title}</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    flex: 1,
                  }}
                >
                  {q.tasks.map((t, i) => (
                    <div key={i} className="mini-task">
                      <div
                        className="stripe"
                        style={{ background: SPHERES[t.sphere].color }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="name">{t.name}</div>
                        <div className="sub">{t.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="foot">
                  <span>{q.tasks.length} задач</span>
                  <Icon
                    name="plus"
                    size={12}
                    color={q.accent}
                    strokeWidth={2.2}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="card flat" style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--ink-400)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Обзор недели
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {SUMMARY.map((s) => (
                <div key={s.l} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: s.c,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.v}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-500)",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
