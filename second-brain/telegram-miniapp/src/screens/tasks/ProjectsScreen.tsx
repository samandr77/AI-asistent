import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createTaskProject, listTaskProjects } from "../../services/api";
import type { TaskProject } from "../../types/api";
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
} from "./components/shell";

type Health = "ok" | "risk" | "idle";
type Tab = "Projects" | "Areas" | "Resources" | "Archive";

const HEALTH: Record<Health, { c: string; l: string }> = {
  ok: { c: "var(--success)", l: "В графике" },
  risk: { c: "var(--warn)", l: "Риск срыва" },
  idle: { c: "var(--ink-400)", l: "Без активности" },
};

function projectHealth(project: TaskProject): Health {
  if (project.status === "archived") return "idle";
  if ((project.progress_percent ?? 0) >= 75) return "ok";
  return (project.tasks_count ?? 0) > 0 ? "risk" : "idle";
}

export function ProjectsScreen() {
  const [tab, setTab] = useState<Tab>("Projects");
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({
    queryKey: ["task-projects"],
    queryFn: listTaskProjects,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createTaskProject({
        title: "Новый проект",
        description: "Опишите цель проекта и добавьте первые задачи.",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["task-projects"] });
    },
  });

  const projects = projectsQuery.data ?? [];
  const activeProjects = projects.filter((project) => project.status === "active");
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const counts = {
    Projects: activeProjects.length,
    Areas: 0,
    Resources: 0,
    Archive: archivedProjects.length,
  };
  const visible =
    tab === "Projects" ? activeProjects : tab === "Archive" ? archivedProjects : [];
  const totalOpen = projects.reduce(
    (sum, project) => sum + ((project.tasks_count ?? 0) - (project.done_count ?? 0)),
    0,
  );

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <>
              <IconBtn name="search" variant="on-card" ariaLabel="Поиск" />
              <IconBtn
                name="plus"
                variant="on-card"
                ariaLabel="Новый проект"
                onClick={() => createMutation.mutate()}
              />
            </>
          }
          eyebrow="PARA · Tiago Forte"
          title="Проекты"
          subtitle={`${activeProjects.length} активных · ${totalOpen} задач в работе`}
        />
        <ScreenBody>
          <AIChip text={<>Соберите проекты по PARA — Tiago Forte.</>} cta={null} />

          <div className="seg">
            {(["Projects", "Areas", "Resources", "Archive"] as Tab[]).map((label) => (
              <button
                key={label}
                type="button"
                className={`s${tab === label ? " active" : ""}`}
                onClick={() => setTab(label)}
              >
                {label} {counts[label] ? `· ${counts[label]}` : ""}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projectsQuery.isLoading ? (
              <div className="empty-state">Загружаем проекты...</div>
            ) : null}
            {visible.map((project) => {
              const pct = project.progress_percent ?? 0;
              const done = project.done_count ?? 0;
              const total = project.tasks_count ?? 0;
              const health = HEALTH[projectHealth(project)];
              return (
                <div key={project.id} className="project-card">
                  <div className="head">
                    <div
                      className="ico"
                      style={{ background: `${SPHERES.work.color}1A` }}
                    >
                      <Icon
                        name="folder"
                        size={20}
                        color={SPHERES.work.color}
                        strokeWidth={2}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{project.title}</div>
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
                            color: health.c,
                            background: "transparent",
                            padding: 0,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: health.c,
                            }}
                          />
                          {health.l}
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
                          {project.deadline ?? "Без срока"}
                        </span>
                      </div>
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
                        {done} / {total} задач
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
                      <i style={{ width: `${pct}%`, background: SPHERES.work.color }} />
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
                        {project.description ?? "Добавьте первый шаг проекта"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!projectsQuery.isLoading && visible.length === 0 ? (
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
            Шаблоны проектов подключены через backend `/task-projects/from-template`
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
