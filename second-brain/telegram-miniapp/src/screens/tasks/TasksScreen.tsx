import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { createTask, getAllTasks, getInboxTasks } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Sphere, Task } from "../../types/api";

import { Icon } from "./components/Icon";
import {
  AIChip,
  DateStrip,
  IconBtn,
  Screen,
  ScreenBody,
  TabBar,
  TaskRow,
  TasksApp,
  TopBar,
  type TaskRowData,
  type TaskSphere,
} from "./components/shell";

// Map backend spheres to design-system spheres (closest visual mapping).
const SPHERE_MAP: Record<Sphere, TaskSphere> = {
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

function mapSphere(s: Sphere | null | undefined): TaskSphere | undefined {
  return s ? SPHERE_MAP[s] : undefined;
}

const WEEKDAY_LABELS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function buildWeekStrip(): {
  dow: string;
  day: number;
  dot: boolean;
  date: Date;
}[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - startIdx);
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dow: WEEKDAY_LABELS[i],
      day: d.getDate(),
      dot: d.toDateString() === today.toDateString(),
      date: d,
    };
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function taskToRow(t: Task): TaskRowData {
  return {
    id: t.id,
    name: t.title,
    sphere: mapSphere(t.sphere),
    flag: t.priority === 1,
    done: t.is_done,
    eta: t.deadline
      ? new Date(t.deadline).toLocaleDateString("ru-RU")
      : undefined,
  };
}

const SPHERE_FILTERS: { id: Sphere | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "work", label: "Работа" },
  { id: "family", label: "Семья" },
  { id: "study", label: "Учёба" },
  { id: "health", label: "Здоровье" },
  { id: "finance", label: "Финансы" },
  { id: "travel", label: "Путешествия" },
  { id: "goals", label: "Цели" },
];

export function TasksScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [sphere, setSphere] = useState<Sphere | "all">("all");
  const weekDays = useMemo(buildWeekStrip, []);
  const todayIdx = useMemo(() => weekDays.findIndex((d) => d.dot), [weekDays]);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(
    todayIdx === -1 ? 2 : todayIdx,
  );
  const setAllTasks = useAppStore((state) => state.setAllTasks);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tasks", "active", sphere],
    queryFn: () => getAllTasks(sphere === "all" ? {} : { sphere }),
  });

  const inboxQuery = useQuery({
    queryKey: ["tasks", "inbox"],
    queryFn: () => getInboxTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      createTask({ title, raw_text: title, status: "inbox" }),
    onSuccess: () => {
      setQuickAdd("");
      setQuickAddError(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      setQuickAddError(t("tasks.quickAdd.error"));
    },
  });

  useEffect(() => {
    if (data) {
      setAllTasks(data);
    }
  }, [data, setAllTasks]);

  const selectedDay = weekDays[selectedDayIdx]?.date ?? new Date();
  const isToday = selectedDayIdx === todayIdx;

  const inboxCount = inboxQuery.data?.length ?? 0;
  const dayTasks = (data ?? []).filter((task) => {
    if (task.is_done) return false;
    if (isToday) {
      if (task.is_today) return true;
      if (task.deadline && isSameDay(new Date(task.deadline), selectedDay)) {
        return true;
      }
      return false;
    }
    if (!task.deadline) return false;
    return isSameDay(new Date(task.deadline), selectedDay);
  });
  const bigThree = dayTasks
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  const moreToday = dayTasks.filter(
    (task) => !bigThree.find((b) => b.id === task.id),
  );
  const trimmed = quickAdd.trim();

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    setQuickAddError(null);
    createMutation.mutate(trimmed);
  }

  const eyebrow = selectedDay.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={
            <IconBtn
              name="settings"
              to="/profile"
              variant="on-card"
              ariaLabel="Настройки"
            />
          }
          right={
            <>
              <IconBtn name="search" variant="on-card" ariaLabel="Поиск" />
              <Link
                to="/tasks/more"
                className="avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  border: "none",
                  textDecoration: "none",
                }}
                aria-label="Меню задач"
              >
                {t("app.name").slice(0, 1)}
              </Link>
            </>
          }
          eyebrow={eyebrow}
          title={t("screens.tasks")}
          subtitle="Сфокусируемся на трёх главных делах"
        />

        <ScreenBody>
          <DateStrip
            days={weekDays}
            activeIdx={selectedDayIdx}
            onSelect={setSelectedDayIdx}
          />

          <AIChip
            text={
              <>
                {isToday ? "На сегодня" : "На выбранный день"}:{" "}
                <b>{dayTasks.length} задач</b>
                {isToday ? `, ${inboxCount} в Inbox` : ""}.
              </>
            }
            cta={inboxCount > 0 ? "В Inbox" : "В матрицу"}
            onCta={() => {
              window.location.href =
                inboxCount > 0 ? "/tasks/inbox" : "/tasks/matrix";
            }}
          />

          <Link className="inbox-bar" to="/tasks/inbox">
            <div className="ico">
              <Icon name="inbox" size={18} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="title">Inbox</div>
              <div className="sub">
                {inboxCount} {inboxCount === 1 ? "новая" : "новых"}
              </div>
            </div>
            <span
              className="pill"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {inboxCount}
            </span>
            <Icon name="chevron" size={16} color="var(--ink-400)" />
          </Link>

          <div className="seg" aria-label="Сфера">
            {SPHERE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={sphere === f.id}
                className={`s${sphere === f.id ? " active" : ""}`}
                onClick={() => setSphere(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {bigThree.length > 0 ? (
            <>
              <div className="scr-section-title">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="target" size={14} color="var(--accent)" /> Big
                  Three · {isToday ? "сегодня" : "выбранный день"}
                </span>
                <span className="count">{bigThree.length} из 3</span>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {bigThree.map((task, i) => (
                  <div key={task.id} className="big-three-wrap">
                    <div className="big-three-badge">{i + 1}</div>
                    <div style={{ paddingLeft: 14 }}>
                      <TaskRow
                        task={taskToRow(task)}
                        to={`/tasks/${task.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {moreToday.length > 0 ? (
            <>
              <div className="scr-section-title" style={{ marginTop: 6 }}>
                <span>{isToday ? "Дальше сегодня" : "Остальное"}</span>
                <span className="count">{moreToday.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {moreToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={taskToRow(task)}
                    to={`/tasks/${task.id}`}
                  />
                ))}
              </div>
            </>
          ) : null}

          {isLoading ? (
            <div className="empty-state">{t("common.loading")}</div>
          ) : null}
          {error ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </button>
          ) : null}
          {data && dayTasks.length === 0 && !isLoading ? (
            <div className="empty-state">{t("tasks.empty")}</div>
          ) : null}

          {quickAddError ? (
            <div className="error-line">{quickAddError}</div>
          ) : null}
        </ScreenBody>

        <form className="quick-add" onSubmit={handleQuickAdd}>
          <input
            type="text"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            placeholder={t("tasks.quickAdd.placeholder")}
            aria-label={t("tasks.quickAdd.placeholder")}
            disabled={createMutation.isPending}
          />
          <Link
            to="/dump"
            className="qa-btn qa-mic"
            aria-label="Голосовой ввод"
          >
            <Icon name="mic" size={16} color="rgba(255,255,255,0.85)" />
          </Link>
          <button
            type="submit"
            className="qa-btn qa-send"
            disabled={!trimmed || createMutation.isPending}
            aria-label={t("tasks.quickAdd.submit")}
          >
            <Icon name="send" size={16} color="#fff" />
          </button>
        </form>

        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
