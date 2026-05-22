import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  listWorkoutSessions,
  getActiveWorkoutSession,
} from "../../services/api";
import type { SportKind } from "../../types/api";
import {
  EmptyState,
  HealthApp,
  HealthBackButton,
  HealthBody,
  HealthCta,
  HealthIconButton,
  HealthScreenLayout,
  HealthTopBar,
  SectionTitle,
} from "./components/shell";
import { WorkoutCard } from "./components/WorkoutCard";
import { Icon } from "./components/Icon";

const FILTERS: { value: SportKind | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "running", label: "Бег" },
  { value: "cycling", label: "Велосипед" },
  { value: "swim_pool", label: "Бассейн" },
  { value: "yoga", label: "Йога" },
  { value: "hiit", label: "HIIT" },
];

export function WorkoutsScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SportKind | "all">("all");

  const { data: active } = useQuery({
    queryKey: ["health", "workouts", "active"],
    queryFn: getActiveWorkoutSession,
  });

  const queryParams = useMemo(
    () => (filter === "all" ? undefined : { sport_kind: filter }),
    [filter],
  );

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["health", "workouts", queryParams],
    queryFn: () => listWorkoutSessions(queryParams),
  });

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={<HealthBackButton fallback="/health" />}
          right={
            <>
              <Link to="/health/exercises" aria-label="Библиотека упражнений">
                <HealthIconButton
                  name="list"
                  onClick={() => navigate("/health/exercises")}
                  label="Библиотека упражнений"
                />
              </Link>
              <HealthIconButton
                name="plus"
                onClick={() => navigate("/health/workouts/new")}
                label="Новая тренировка"
              />
            </>
          }
          eyebrow="Здоровье"
          title="Тренировки"
        />
        <HealthBody>
          {active && !active.is_completed ? (
            <Link
              to={`/health/workouts/${active.id}/log`}
              className="rest-timer rest-timer--done"
              style={{ textDecoration: "none" }}
            >
              <div className="rest-timer-label">Идёт тренировка</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {active.title}
              </div>
              <span className="rest-timer-skip">Продолжить</span>
            </Link>
          ) : null}

          <div className="filter-chips" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={"filter-chip" + (filter === f.value ? " is-on" : "")}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <SectionTitle>История</SectionTitle>

          {isLoading ? (
            <div className="health-empty">Загружаем…</div>
          ) : !sessions || sessions.length === 0 ? (
            <EmptyState
              title="Тренировок пока нет"
              description="Начни первую — выбери тип спорта и логируй подходы или дистанцию."
              action={
                <HealthCta onClick={() => navigate("/health/workouts/new")}>
                  <Icon name="plus" size={18} /> Новая тренировка
                </HealthCta>
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map((s) => (
                <WorkoutCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </HealthBody>
      </HealthScreenLayout>
    </HealthApp>
  );
}
