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
import { Icon } from "./components/Icon";

interface Slot {
  num: number;
  name: string;
  sphere: TaskSphere;
  why: string;
  time: string;
  eta: string;
  flag?: string;
}

const SLOTS: Slot[] = [];

const CANDIDATES: { name: string; sphere: TaskSphere }[] = [];

export function BigThreeScreen() {
  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <IconBtn name="info" variant="on-card" ariaLabel="Подсказка" />
          }
          eyebrow={new Date().toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          title="Только три на сегодня"
          subtitle="Метод «Big Three» — выберите самое важное, остальное — фон"
        />
        <ScreenBody>
          <AIChip
            text={
              <>Выберите три главные задачи на день — AI поможет подобрать.</>
            }
            cta={null}
          />

          {SLOTS.length === 0 ? (
            <div className="empty-state">Ещё не выбраны задачи на сегодня.</div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SLOTS.map((s) => (
              <div
                key={s.num}
                className="big-three-card"
                style={{ borderLeftColor: SPHERES[s.sphere].color }}
              >
                <div className="num">{s.num}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.flag ? (
                    <div className="flag">
                      <Icon name="sparkle" size={10} color="var(--accent)" />{" "}
                      {s.flag}
                    </div>
                  ) : null}
                  <div className="name">{s.name}</div>
                  <div className="why">«{s.why}»</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="chip">
                      <Icon
                        name="clock"
                        size={10}
                        color="var(--ink-500)"
                        strokeWidth={2}
                      />
                      {s.time}
                    </span>
                    <span className="chip">{s.eta}</span>
                    <SphereChip sphere={s.sphere} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="scr-section-title" style={{ marginTop: 6 }}>
            <span>Можно заменить</span>
            <span className="count">{CANDIDATES.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CANDIDATES.map((c) => (
              <div key={c.name} className="candidate">
                <div
                  className="stripe"
                  style={{ background: SPHERES[c.sphere].color }}
                />
                <div
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink-800)",
                  }}
                >
                  {c.name}
                </div>
                <button type="button" className="btn tiny ghost">
                  В Big Three
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "var(--ink-400)",
              fontWeight: 500,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Тройка зафиксирована до 23:59. Завтра выберем заново.
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
