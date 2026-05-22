import { useQueries, useQuery } from "@tanstack/react-query";

import { getHabitStats, listHabits, updateTask } from "../../services/api";
import type { Sphere, Task } from "../../types/api";
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

const SPHERE_TO_CHIP: Record<Sphere, "work" | "health" | "finance" | "personal" | "mind"> = {
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

function HabitRow({ habit }: { habit: Task }) {
  const statsQuery = useQuery({
    queryKey: ["tasks", "habits", habit.id, "stats"],
    queryFn: () => getHabitStats(habit.id),
  });
  const stats = statsQuery.data;
  const sphere = habit.sphere ? SPHERE_TO_CHIP[habit.sphere] : "personal";

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className={`check${habit.is_done ? " done" : ""}`}
          style={{ width: 22, height: 22, borderRadius: 8 }}
          aria-label="Отметить привычку"
          onClick={() => void updateTask(habit.id, { is_done: true })}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--ink-900)",
              textDecoration: habit.is_done ? "line-through" : "none",
              opacity: habit.is_done ? 0.55 : 1,
            }}
          >
            {habit.title}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
            <SphereChip sphere={sphere} />
            <span className="chip" style={{ background: "transparent", color: "var(--ink-500)", padding: 0 }}>
              <Icon name="repeat" size={10} color="var(--ink-500)" strokeWidth={2} />
              {habit.recurrence_rule ? "повторяется" : "без правила"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-700)" }}>
            {stats?.current_streak ?? 0}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--ink-400)", fontWeight: 600 }}>
            ДНЕЙ
          </div>
        </div>
      </div>
      <div className="habit-chain">
        {Array.from({ length: 28 }).map((_, index) => {
          const done = index >= 28 - (stats?.current_streak ?? 0);
          return <div key={index} className={`cell${done ? " on" : ""}`} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-500)" }}>
        <span>90 дней: {Math.round((stats?.completion_rate_90d ?? 0) * 100)}%</span>
        <span>лучший стрик: {stats?.longest_streak ?? 0}</span>
      </div>
    </div>
  );
}

export function HabitsScreen() {
  const habitsQuery = useQuery({
    queryKey: ["tasks", "habits"],
    queryFn: listHabits,
  });
  const habits = habitsQuery.data ?? [];
  const statsQueries = useQueries({
    queries: habits.map((habit) => ({
      queryKey: ["tasks", "habits", habit.id, "stats", "summary"],
      queryFn: () => getHabitStats(habit.id),
    })),
  });
  const doneToday = habits.filter((habit) => habit.is_done).length;
  const avgRate =
    statsQueries.length > 0
      ? Math.round(
          (statsQueries.reduce((sum, query) => sum + (query.data?.completion_rate_90d ?? 0), 0) /
            statsQueries.length) *
            100,
        )
      : 0;

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="plus" variant="on-card" ariaLabel="Новая привычка" />}
          eyebrow="Phillippa Lally · 66 дней до привычки"
          title="Привычки и ритуалы"
          subtitle="Стрики и статистика регулярности"
        />
        <ScreenBody>
          <AIChip text={<>Добавьте первую привычку — AI поможет настроить напоминания.</>} cta={null} />

          <div className="scr-section-title">
            <span>Сегодня</span>
            <span className="count">
              {doneToday} из {habits.length} выполнено
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {habitsQuery.isLoading ? <div className="empty-state">Загружаем привычки...</div> : null}
            {habits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
            {!habitsQuery.isLoading && habits.length === 0 ? (
              <div className="empty-state">Пока нет привычек.</div>
            ) : null}
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-900)" }}>
                Эта неделя
              </div>
              <span className="pill ghost">{avgRate}%</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", lineHeight: 1.5 }}>
              Здесь показываются только продуктивность, стрики и регулярность.
            </div>
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
