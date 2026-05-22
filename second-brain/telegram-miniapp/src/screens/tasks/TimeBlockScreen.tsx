import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getTaskCalendar } from "../../services/api";
import {
  AIChip,
  BackBtn,
  Screen,
  ScreenBody,
  SPHERES,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
const HOUR_H = 44;
const today = new Date().toISOString().slice(0, 10);

function fmt(value: string): string {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hourValue(value: string): number {
  const dt = new Date(value);
  return dt.getHours() + dt.getMinutes() / 60;
}

export function TimeBlockScreen() {
  const calendarQuery = useQuery({
    queryKey: ["tasks", "calendar", today],
    queryFn: () => getTaskCalendar(today, 1),
  });
  const day = calendarQuery.data?.days[0];
  const blocks = day?.tasks ?? [];
  const capacity = day?.capacity;
  const scheduledMin = capacity?.scheduled_min ?? 0;
  const deepWorkMin = blocks
    .filter((task) => task.deep_work)
    .reduce((sum, task) => {
      if (!task.scheduled_start || !task.scheduled_end) return sum;
      return sum + Math.max(0, Math.round((new Date(task.scheduled_end).getTime() - new Date(task.scheduled_start).getTime()) / 60000));
    }, 0);

  const summary = [
    { l: "Запланировано", v: `${scheduledMin}м`, c: "var(--ink-900)" },
    { l: "Deep Work", v: `${deepWorkMin}м`, c: "var(--focus)" },
    { l: "Свободно", v: `${capacity?.remaining_min ?? 0}м`, c: "var(--success)" },
  ];

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={
            <div className="seg" style={{ padding: 2, height: 30 }}>
              <button type="button" className="s active" style={{ padding: "4px 8px", fontSize: 11 }}>
                День
              </button>
              <button type="button" className="s" style={{ padding: "4px 8px", fontSize: 11 }}>
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
          subtitle="Внутренний календарь задач без внешних интеграций"
        />
        <ScreenBody>
          <AIChip text={<>Распланируйте день блоками — добавьте задаче время начала и конца.</>} cta={null} />

          <div className="summary-row">
            {summary.map((s) => (
              <div key={s.l} className="card flat stat">
                <div className="l">{s.l}</div>
                <div className="v" style={{ color: s.c }}>
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div className="card timeline">
            <div className="timeline-track" style={{ height: HOURS.length * HOUR_H }}>
              {HOURS.map((h, i) => (
                <div key={h} className="timeline-hour" style={{ top: i * HOUR_H }}>
                  <div className="lbl">{h.toString().padStart(2, "0")}:00</div>
                </div>
              ))}

              {blocks.map((task) => {
                if (!task.scheduled_start || !task.scheduled_end) return null;
                const top = (hourValue(task.scheduled_start) - 8) * HOUR_H + 2;
                const height = Math.max(28, (hourValue(task.scheduled_end) - hourValue(task.scheduled_start)) * HOUR_H - 4);
                const color = task.deep_work ? SPHERES.work.color : "var(--accent)";
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="tb-block"
                    style={{
                      top,
                      height,
                      background: `${color}1F`,
                      borderLeftColor: color,
                    }}
                  >
                    <div className="label">{task.title}</div>
                    {height > 28 ? (
                      <div className="time">
                        {fmt(task.scheduled_start)} – {fmt(task.scheduled_end)}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
              {!calendarQuery.isLoading && blocks.length === 0 ? (
                <div className="empty-state">Сегодня пока нет временных блоков.</div>
              ) : null}
            </div>
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
