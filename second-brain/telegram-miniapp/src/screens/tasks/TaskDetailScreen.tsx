import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { deleteTask, getTask, updateTask } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Task } from "../../types/api";

import { Icon, type TaskIconName } from "./components/Icon";
import {
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SphereChip,
  TasksApp,
  TopBar,
} from "./components/shell";

interface TaskDetailState {
  task?: Task;
}

const SPHERE_TO_CHIP: Record<
  string,
  "work" | "health" | "finance" | "personal" | "mind"
> = {
  work: "work",
  family: "personal",
  study: "mind",
  health: "health",
  finance: "finance",
  travel: "personal",
  goals: "work",
};

export function TaskDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams();
  const state = location.state as TaskDetailState | null;
  const removeTaskFromStore = useAppStore((store) => store.removeTaskFromStore);
  const updateTaskInStore = useAppStore((store) => store.updateTaskInStore);
  const [title, setTitle] = useState(state?.task?.title ?? "");

  const { data } = useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () =>
      taskId ? getTask(taskId) : Promise.reject(new Error("Missing task id")),
    enabled: !state?.task,
  });

  const task = state?.task ?? data ?? null;

  useEffect(() => {
    if (task && !title) {
      setTitle(task.title);
    }
  }, [task, title]);

  const saveMutation = useMutation({
    mutationFn: () => updateTask(taskId ?? "", { title }),
    onSuccess: (updated) => {
      updateTaskInStore(updated.id, updated);
    },
  });
  const doneMutation = useMutation({
    mutationFn: () => updateTask(taskId ?? "", { is_done: true }),
    onSuccess: (updated) => {
      updateTaskInStore(updated.id, updated);
      navigate("/tasks");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId ?? ""),
    onSuccess: () => {
      if (taskId) removeTaskFromStore(taskId);
      navigate("/tasks", { replace: true });
    },
  });

  if (!task) {
    return (
      <TasksApp>
        <Screen>
          <TopBar left={<BackBtn to="/tasks" />} />
          <ScreenBody>
            <div className="empty-state">{t("tasks.notFound")}</div>
          </ScreenBody>
        </Screen>
      </TasksApp>
    );
  }

  const priorityLabel =
    task.priority === 1
      ? "Высокий"
      : task.priority === 2
        ? "Средний"
        : "Низкий";

  const metaRows: { icon: TaskIconName; l: string; v: string }[] = [
    {
      icon: "calendar",
      l: "Дедлайн",
      v: task.deadline
        ? new Date(task.deadline).toLocaleString("ru-RU", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Без срока",
    },
    {
      icon: "flag",
      l: "Приоритет",
      v: priorityLabel,
    },
    {
      icon: "folder",
      l: "Сфера",
      v: task.sphere ?? "Без сферы",
    },
    {
      icon: "repeat",
      l: "Повторение",
      v: "Один раз",
    },
  ];

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <>
              <IconBtn name="bell" variant="on-card" ariaLabel="Напоминание" />
              <IconBtn name="more" variant="on-card" ariaLabel="Ещё" />
            </>
          }
        />

        <ScreenBody style={{ paddingTop: 4 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span className="pill accent">
              <span className="dot" /> {t(`tasks.status.${task.status}`)}
            </span>
            {task.sphere && SPHERE_TO_CHIP[task.sphere] ? (
              <SphereChip sphere={SPHERE_TO_CHIP[task.sphere]} />
            ) : null}
            {task.priority === 1 ? (
              <span
                className="pill"
                style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
              >
                <Icon
                  name="flag"
                  size={11}
                  color="var(--warn)"
                  strokeWidth={2.2}
                />{" "}
                Срочно
              </span>
            ) : null}
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink-400)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {t("tasks.title")}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color: "var(--ink-900)",
                background: "var(--card)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 12,
                padding: "10px 14px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </label>

          {task.raw_text ? (
            <div className="raw-quote">
              <div className="label">{t("tasks.inbox.originalLabel")}</div>«
              {task.raw_text}»
            </div>
          ) : null}

          <div className="meta-grid">
            {metaRows.map((row) => (
              <div key={row.l} className="row">
                <div className="ico">
                  <Icon name={row.icon} size={14} color="var(--ink-600)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="l">{row.l}</div>
                  <div className="v">{row.v}</div>
                </div>
                <Icon name="chevron" size={14} color="var(--ink-300)" />
              </div>
            ))}
          </div>

          <div className="ai-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                className="ai-dot"
                style={{ width: 26, height: 26, borderRadius: 9 }}
              >
                AI
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                }}
              >
                Подсказка ассистента
              </div>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-700)",
                lineHeight: 1.45,
              }}
            >
              Хотите разбить задачу на подзадачи или запустить фокус-сессию?
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button
                type="button"
                className="btn primary tiny"
                onClick={() => navigate("/tasks/focus")}
              >
                Pomodoro
              </button>
              <button
                type="button"
                className="btn ghost tiny"
                onClick={() => navigate("/tasks/ai")}
              >
                Спросить AI
              </button>
            </div>
          </div>

          {task.notes ? (
            <div className="card flat">
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-500)",
                  lineHeight: 1.5,
                }}
              >
                {task.notes}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn primary"
              disabled={!title.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={doneMutation.isPending}
              onClick={() => doneMutation.mutate()}
            >
              {t("tasks.markDone")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              style={{ color: "var(--danger)" }}
            >
              {t("common.delete")}
            </button>
          </div>
        </ScreenBody>

        <div className="sticky-cta">
          <button
            type="button"
            className="btn lg dark"
            style={{ flex: 1 }}
            onClick={() => navigate("/tasks/focus")}
          >
            <Icon name="play" size={16} color="#fff" /> Начать фокус-сессию
          </button>
        </div>
      </Screen>
    </TasksApp>
  );
}
