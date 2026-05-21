import { useState } from "react";

import { Icon, type TaskIconName } from "./components/Icon";
import {
  AIChip,
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

interface Ctx {
  id: string;
  label: string;
  count: number;
  icon: TaskIconName;
}

const CONTEXTS: Ctx[] = [
  { id: "home", label: "дом", count: 0, icon: "home" },
  { id: "office", label: "офис", count: 0, icon: "folder" },
  { id: "phone", label: "телефон", count: 0, icon: "mic" },
  { id: "computer", label: "компьютер", count: 0, icon: "grid" },
  { id: "errands", label: "по дороге", count: 0, icon: "location" },
  { id: "waiting", label: "ожидает", count: 0, icon: "clock" },
];

const SMART: { name: string; count: number; c: string; icon: TaskIconName }[] =
  [
    { name: "Просроченные", count: 0, c: "var(--danger)", icon: "flag" },
    { name: "Без даты", count: 0, c: "var(--ink-500)", icon: "calendar" },
    { name: "Высокий приоритет", count: 0, c: "var(--warn)", icon: "bolt" },
    { name: "Deep Work блоки", count: 0, c: "var(--focus)", icon: "target" },
  ];

const SAVED: { name: string; q: string; count: number }[] = [];

export function ContextsScreen() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <IconBtn name="plus" variant="on-card" ariaLabel="Новый контекст" />
          }
          eyebrow="GTD · контекстное планирование"
          title="Контексты и фильтры"
          subtitle="Только то, что можно сделать прямо сейчас"
        />
        <ScreenBody>
          <AIChip
            text={<>Выберите контекст, чтобы увидеть подходящие задачи.</>}
            cta={null}
          />

          <div className="scr-section-title">
            <span>Контексты</span>
            <span className="count">{CONTEXTS.length}</span>
          </div>

          <div className="ctx-grid">
            {CONTEXTS.map((c) => {
              const isActive = c.id === active;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ctx-card${isActive ? " active" : ""}`}
                  onClick={() => setActive(c.id)}
                >
                  <div className="ico">
                    <Icon
                      name={c.icon}
                      size={15}
                      color={isActive ? "#fff" : "var(--ink-700)"}
                    />
                  </div>
                  <div>
                    <div className="at">@</div>
                    <div className="lbl">{c.label}</div>
                    <div className="cnt">{c.count} задач</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="scr-section-title">
            <span>Умные списки</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SMART.map((s) => (
              <div key={s.name} className="card flat smart-row">
                <div
                  className="ico"
                  style={{ background: `${s.c}14`, color: s.c }}
                >
                  <Icon name={s.icon} size={14} color={s.c} strokeWidth={2.2} />
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--ink-900)",
                  }}
                >
                  {s.name}
                </div>
                <span className="pill ghost">{s.count}</span>
              </div>
            ))}
          </div>

          <div className="scr-section-title">
            <span>Сохранённые фильтры</span>
            <span
              style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}
            >
              + Создать
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SAVED.map((s) => (
              <div key={s.name} className="card flat saved-filter">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--ink-900)",
                    }}
                  >
                    {s.name}
                  </div>
                  <span className="pill accent">{s.count}</span>
                </div>
                <div className="q">{s.q}</div>
              </div>
            ))}
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
