import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getTaskMatrix, updateTask } from "../../services/api";
import type { EisenhowerQuadrant, Sphere, Task } from "../../types/api";
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
  id: EisenhowerQuadrant;
  title: string;
  sub: string;
  accent: string;
  tone: string;
  border: string;
}

const QUADS: Quad[] = [
  {
    id: "do_now",
    title: "Сделать сейчас",
    sub: "Срочно · Важно",
    accent: "var(--danger)",
    tone: "rgba(221,63,82,0.06)",
    border: "rgba(221,63,82,0.18)",
  },
  {
    id: "schedule",
    title: "Запланировать",
    sub: "Важно · Несрочно",
    accent: "var(--accent)",
    tone: "rgba(46,91,255,0.06)",
    border: "rgba(46,91,255,0.18)",
  },
  {
    id: "delegate",
    title: "Делегировать",
    sub: "Срочно · Неважно",
    accent: "var(--warn)",
    tone: "rgba(220,138,30,0.06)",
    border: "rgba(220,138,30,0.18)",
  },
  {
    id: "delete",
    title: "Удалить / отложить",
    sub: "Несрочно · Неважно",
    accent: "var(--ink-400)",
    tone: "var(--card-tint)",
    border: "var(--hairline)",
  },
];

const SPHERE_TO_CHIP: Record<Sphere, TaskSphere> = {
  work: "work",
  family: "personal",
  study: "mind",
  health: "health",
  finance: "finance",
  travel: "personal",
  goals: "work",
  mind: "mind",
  personal: "personal",
};

function taskMeta(task: Task): string {
  const parts = [];
  if (task.deadline) parts.push(new Date(task.deadline).toLocaleDateString("ru-RU"));
  if (task.goal_id) parts.push("связана с целью");
  if (task.tags?.length) parts.push(task.tags.slice(0, 2).map((tag) => `#${tag}`).join(" "));
  return parts.join(" · ") || "без срока";
}

export function MatrixScreen() {
  const queryClient = useQueryClient();
  const matrixQuery = useQuery({
    queryKey: ["tasks", "matrix"],
    queryFn: getTaskMatrix,
  });
  const moveMutation = useMutation({
    mutationFn: ({ task, quadrant }: { task: Task; quadrant: EisenhowerQuadrant }) =>
      updateTask(task.id, { eisenhower_quadrant: quadrant }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const matrix = matrixQuery.data;

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="more" variant="on-card" ariaLabel="Ещё" />}
          eyebrow="Метод Эйзенхауэра"
          title="Матрица приоритетов"
          subtitle="Переносите задачи в нужный квадрант"
        />
        <ScreenBody>
          <AIChip text={<>Распределите задачи по квадрантам — AI поможет с приоритетами.</>} cta={null} />

          <div className="matrix-grid">
            {QUADS.map((q) => {
              const tasks = matrix?.[q.id] ?? [];
              return (
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {tasks.map((task) => {
                      const sphere = task.sphere ? SPHERE_TO_CHIP[task.sphere] : "personal";
                      return (
                        <Link key={task.id} to={`/tasks/${task.id}`} className="mini-task">
                          <div className="stripe" style={{ background: SPHERES[sphere].color }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="name">{task.title}</div>
                            <div className="sub">{taskMeta(task)}</div>
                          </div>
                        </Link>
                      );
                    })}
                    {tasks.length === 0 ? <div className="empty-state">Пусто</div> : null}
                  </div>
                  <div className="foot">
                    <span>{tasks.length} задач</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Назначить первую задачу в ${q.title}`}
                      onClick={() => {
                        const first = QUADS.flatMap((quad) => matrix?.[quad.id] ?? []).find(
                          (task) => task.eisenhower_quadrant !== q.id,
                        );
                        if (first) moveMutation.mutate({ task: first, quadrant: q.id });
                      }}
                    >
                      <Icon name="plus" size={12} color={q.accent} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card flat" style={{ padding: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Обзор
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {QUADS.map((q) => (
                <div key={q.id} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: q.accent, letterSpacing: "-0.02em" }}>
                    {matrix?.[q.id]?.length ?? 0}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-500)", fontWeight: 600, marginTop: 2 }}>
                    {q.title.split(" ")[0]}
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
