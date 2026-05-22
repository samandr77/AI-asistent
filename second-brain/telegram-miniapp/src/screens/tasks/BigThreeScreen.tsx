import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getAllTasks, getBigThree, setBigThree } from "../../services/api";
import { Icon } from "./components/Icon";
import {
  AIChip,
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SphereChip,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

const today = new Date().toISOString().slice(0, 10);

export function BigThreeScreen() {
  const queryClient = useQueryClient();
  const bigThreeQuery = useQuery({
    queryKey: ["tasks", "big-three", today],
    queryFn: () => getBigThree(today),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "active", "big-three"],
    queryFn: () => getAllTasks({ limit: 100 }),
  });
  const selectedIds = bigThreeQuery.data?.items.map((item) => item.task_id) ?? [];
  const tasks = tasksQuery.data ?? [];
  const selectedTasks = selectedIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter(Boolean);
  const candidates = tasks
    .filter((task) => !selectedIds.includes(task.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  const saveMutation = useMutation({
    mutationFn: (taskIds: string[]) => setBigThree(today, taskIds.slice(0, 3)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "big-three"] });
    },
  });

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="info" variant="on-card" ariaLabel="Подсказка" />}
          eyebrow={new Date().toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          title="Только три на сегодня"
          subtitle="Метод Big Three — выберите самое важное, остальное фон"
        />
        <ScreenBody>
          <AIChip text={<>Выберите три главные задачи на день — максимум 3.</>} cta={null} />

          {selectedTasks.length === 0 ? (
            <div className="empty-state">Ещё не выбраны задачи на сегодня.</div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {selectedTasks.map((task, index) =>
              task ? (
                <div key={task.id} className="big-three-card" style={{ borderLeftColor: "var(--accent)" }}>
                  <div className="num">{index + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {task.goal_id ? (
                      <div className="flag">
                        <Icon name="target" size={10} color="var(--accent)" /> связана с целью
                      </div>
                    ) : null}
                    <Link to={`/tasks/${task.id}`} className="name">
                      {task.title}
                    </Link>
                    <div className="why">приоритет {task.priority}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <span className="chip">
                        <Icon name="calendar" size={10} color="var(--ink-500)" strokeWidth={2} />
                        {task.deadline ? new Date(task.deadline).toLocaleDateString("ru-RU") : "без срока"}
                      </span>
                      <SphereChip sphere={task.sphere === "health" ? "health" : task.sphere === "finance" ? "finance" : "work"} />
                    </div>
                  </div>
                </div>
              ) : null,
            )}
          </div>

          <div className="scr-section-title" style={{ marginTop: 6 }}>
            <span>Можно выбрать</span>
            <span className="count">{candidates.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidates.map((task) => (
              <div key={task.id} className="candidate">
                <div className="stripe" style={{ background: "var(--accent)" }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
                  {task.title}
                </div>
                <button
                  type="button"
                  className="btn tiny ghost"
                  disabled={selectedIds.length >= 3 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate([...selectedIds, task.id])}
                >
                  В Big Three
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-400)", fontWeight: 500, textAlign: "center", lineHeight: 1.5 }}>
            Тройка фиксируется на выбранный день. Завтра можно выбрать заново.
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
