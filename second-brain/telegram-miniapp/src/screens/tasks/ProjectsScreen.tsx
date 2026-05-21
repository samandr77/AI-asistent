import { useState } from "react";

import { Icon } from "./components/Icon";
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

type Health = "ok" | "risk" | "idle";

interface Project {
  id: string;
  name: string;
  sphere: TaskSphere;
  area: "Projects" | "Areas";
  done: number;
  total: number;
  deadline: string;
  members: string[];
  next: string;
  health: Health;
}

const PROJECTS: Project[] = [];

const HEALTH: Record<Health, { c: string; l: string }> = {
  ok: { c: "var(--success)", l: "В графике" },
  risk: { c: "var(--warn)", l: "Риск срыва" },
  idle: { c: "var(--ink-400)", l: "Без активности" },
};

type Tab = "Projects" | "Areas" | "Resources" | "Archive";

export function ProjectsScreen() {
  const [tab, setTab] = useState<Tab>("Projects");
  const counts = {
    Projects: PROJECTS.filter((p) => p.area === "Projects").length,
    Areas: PROJECTS.filter((p) => p.area === "Areas").length,
    Resources: 0,
    Archive: 0,
  };
  const visible = PROJECTS.filter((p) => p.area === tab);
  const totalOpen = PROJECTS.reduce((s, p) => s + (p.total - p.done), 0);

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <>
              <IconBtn name="search" variant="on-card" ariaLabel="Поиск" />
              <IconBtn name="plus" variant="on-card" ariaLabel="Новый проект" />
            </>
          }
          eyebrow="PARA · Tiago Forte"
          title="Проекты"
          subtitle={`${PROJECTS.length} активных · ${totalOpen} задач в работе`}
        />
        <ScreenBody>
          <AIChip
            text={<>Соберите проекты по PARA — Tiago Forte.</>}
            cta={null}
          />

          <div className="seg">
            {(["Projects", "Areas", "Resources", "Archive"] as Tab[]).map(
              (label) => (
                <button
                  key={label}
                  type="button"
                  className={`s${tab === label ? " active" : ""}`}
                  onClick={() => setTab(label)}
                >
                  {label} {counts[label] ? `· ${counts[label]}` : ""}
                </button>
              ),
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map((p) => {
              const pct = (p.done / p.total) * 100;
              const h = HEALTH[p.health];
              return (
                <div key={p.id} className="project-card">
                  <div className="head">
                    <div
                      className="ico"
                      style={{ background: `${SPHERES[p.sphere].color}1A` }}
                    >
                      <Icon
                        name="folder"
                        size={20}
                        color={SPHERES[p.sphere].color}
                        strokeWidth={2}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{p.name}</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 4,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="chip"
                          style={{
                            color: h.c,
                            background: "transparent",
                            padding: 0,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: h.c,
                            }}
                          />
                          {h.l}
                        </span>
                        <span
                          className="chip"
                          style={{
                            background: "transparent",
                            padding: 0,
                            color: "var(--ink-500)",
                          }}
                        >
                          <Icon
                            name="calendar"
                            size={10}
                            color="var(--ink-500)"
                            strokeWidth={2}
                          />
                          {p.deadline}
                        </span>
                      </div>
                    </div>
                    <div className="avatars">
                      {p.members.map((m, i) => (
                        <div
                          key={i}
                          className="avatar"
                          style={{
                            background: m.startsWith("+")
                              ? "var(--ink-300)"
                              : `hsl(${i * 80 + 200}, 60%, 55%)`,
                          }}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-500)",
                          fontWeight: 600,
                        }}
                      >
                        {p.done} / {p.total} задач
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-700)",
                          fontWeight: 700,
                        }}
                      >
                        {Math.round(pct)}%
                      </div>
                    </div>
                    <div className="bar">
                      <i
                        style={{
                          width: `${pct}%`,
                          background: SPHERES[p.sphere].color,
                        }}
                      />
                    </div>
                  </div>

                  <div className="next">
                    <Icon
                      name="chevron"
                      size={12}
                      color="var(--accent)"
                      strokeWidth={2.2}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: "var(--ink-400)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Следующий шаг
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--ink-800)",
                          marginTop: 1,
                        }}
                      >
                        {p.next}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 ? (
              <div className="empty-state">Нет проектов в этой категории.</div>
            ) : null}
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "14px 0",
              color: "var(--ink-400)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            + новый проект из шаблона
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
