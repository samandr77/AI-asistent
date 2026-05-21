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

interface Block {
  start: number;
  end: number;
  label: string;
  sphere: TaskSphere;
  flag?: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
const HOUR_H = 44;

const BLOCKS: Block[] = [];

const NOW = 10 + 18 / 60;

function fmt(t: number): string {
  const h = Math.floor(t);
  const m = Math.round((t % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

const SUMMARY = [
  { l: "Запланировано", v: "0м", c: "var(--ink-900)" },
  { l: "Deep Work", v: "0м", c: "var(--focus)" },
  { l: "Свободно", v: "—", c: "var(--success)" },
];

export function TimeBlockScreen() {
  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <div className="seg" style={{ padding: 2, height: 30 }}>
              <button
                type="button"
                className="s"
                style={{ padding: "4px 8px", fontSize: 11 }}
              >
                День
              </button>
              <button
                type="button"
                className="s active"
                style={{ padding: "4px 8px", fontSize: 11 }}
              >
                Неделя
              </button>
            </div>
          }
          eyebrow={new Date().toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          title="Тайм-блокинг"
          subtitle="Защищайте время для глубокой работы"
        />
        <ScreenBody>
          <AIChip
            text={<>Распланируйте день блоками — добавьте первую задачу.</>}
            cta={null}
          />

          <div className="summary-row">
            {SUMMARY.map((s) => (
              <div key={s.l} className="card flat stat">
                <div className="l">{s.l}</div>
                <div className="v" style={{ color: s.c }}>
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div className="card timeline">
            <div
              className="timeline-track"
              style={{ height: HOURS.length * HOUR_H }}
            >
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="timeline-hour"
                  style={{ top: i * HOUR_H }}
                >
                  <div className="lbl">{h.toString().padStart(2, "0")}:00</div>
                </div>
              ))}

              <div className="now-line" style={{ top: (NOW - 8) * HOUR_H }}>
                <div className="dot" />
                <div className="line" />
                <div className="badge">{fmt(NOW)}</div>
              </div>

              {BLOCKS.map((b, i) => {
                const top = (b.start - 8) * HOUR_H + 2;
                const height = (b.end - b.start) * HOUR_H - 4;
                const color = SPHERES[b.sphere].color;
                return (
                  <div
                    key={i}
                    className="tb-block"
                    style={{
                      top,
                      height,
                      background: `${color}1F`,
                      borderLeftColor: color,
                    }}
                  >
                    <div className="label">
                      {b.flag ? (
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 999,
                            background: color,
                          }}
                        />
                      ) : null}
                      {b.label}
                    </div>
                    {height > 28 ? (
                      <div className="time">
                        {fmt(b.start)} – {fmt(b.end)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
