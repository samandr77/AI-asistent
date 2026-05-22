import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { listExercises } from "../../services/api";
import type { PrimaryMuscle } from "../../types/api";
import {
  EmptyState,
  HealthApp,
  HealthBackButton,
  HealthBody,
  HealthScreenLayout,
  HealthTopBar,
} from "./components/shell";
import { HealthField } from "./components/Sheet";
import { muscleGroupLabel } from "./components/sports";

const MUSCLE_FILTERS: { value: PrimaryMuscle | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "chest", label: "Грудь" },
  { value: "back", label: "Спина" },
  { value: "lats", label: "Широчайшие" },
  { value: "delts_side", label: "Плечи" },
  { value: "biceps", label: "Бицепс" },
  { value: "triceps", label: "Трицепс" },
  { value: "quads", label: "Квадры" },
  { value: "hamstrings", label: "Бицепс бедра" },
  { value: "glutes", label: "Ягодицы" },
  { value: "calves", label: "Икры" },
  { value: "abs", label: "Пресс" },
];

export function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const [muscle, setMuscle] = useState<PrimaryMuscle | "all">("all");
  const [search, setSearch] = useState("");

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["health", "exercises", { muscle, search }],
    queryFn: () =>
      listExercises({
        muscle: muscle === "all" ? undefined : muscle,
        search: search.trim() || undefined,
        limit: 100,
      }),
  });

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={<HealthBackButton fallback="/health/workouts" />}
          eyebrow="Здоровье"
          title="Библиотека упражнений"
        />
        <HealthBody>
          <HealthField label="Поиск">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Жим, присед, бег…"
            />
          </HealthField>

          <div className="filter-chips" role="tablist">
            {MUSCLE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={"filter-chip" + (muscle === f.value ? " is-on" : "")}
                onClick={() => setMuscle(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="health-empty">Загружаем…</div>
          ) : !exercises || exercises.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description="Поменяй фильтр или поиск."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {exercises.map((ex) => (
                <Link
                  key={ex.id}
                  to={`/health/exercises/${ex.slug}`}
                  className="exercise-list-row"
                >
                  <div className="exercise-list-row-body">
                    <div className="exercise-list-row-name">{ex.name_ru}</div>
                    <div className="exercise-list-row-meta">
                      {muscleGroupLabel(ex.primary_muscle)}
                      {ex.equipment.length
                        ? ` · ${ex.equipment.join(", ")}`
                        : ""}
                      {ex.is_compound ? " · базовое" : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </HealthBody>
      </HealthScreenLayout>
    </HealthApp>
  );
}
