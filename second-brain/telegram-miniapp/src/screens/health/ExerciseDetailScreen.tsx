import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getExercise } from "../../services/api";
import {
  EmptyState,
  HealthApp,
  HealthBackButton,
  HealthBody,
  HealthScreenLayout,
  HealthTopBar,
  SectionTitle,
} from "./components/shell";
import { muscleGroupLabel } from "./components/sports";

const EQUIPMENT_LABEL: Record<string, string> = {
  barbell: "Штанга",
  dumbbell: "Гантели",
  kettlebell: "Гиря",
  machine: "Тренажёр",
  cable: "Блок",
  bodyweight: "Свой вес",
  band: "Резина",
  smith: "Смит",
  trx: "TRX",
  bench: "Скамья",
  pullup_bar: "Турник",
  none: "Без инвентаря",
};

const CATEGORY_LABEL: Record<string, string> = {
  strength: "Сила",
  cardio: "Кардио",
  stretching: "Растяжка",
  plyometric: "Плиометрика",
  mobility: "Мобильность",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Новичок",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export function ExerciseDetailScreen() {
  const { slug } = useParams<{ slug: string }>();
  const { data: exercise, isLoading } = useQuery({
    queryKey: ["health", "exercises", slug],
    queryFn: () => getExercise(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <HealthApp>
        <HealthScreenLayout>
          <HealthTopBar
            left={<HealthBackButton fallback="/health/exercises" />}
          />
          <HealthBody>
            <div className="health-empty">Загружаем…</div>
          </HealthBody>
        </HealthScreenLayout>
      </HealthApp>
    );
  }

  if (!exercise) {
    return (
      <HealthApp>
        <HealthScreenLayout>
          <HealthTopBar
            left={<HealthBackButton fallback="/health/exercises" />}
          />
          <HealthBody>
            <EmptyState title="Упражнение не найдено" />
          </HealthBody>
        </HealthScreenLayout>
      </HealthApp>
    );
  }

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={<HealthBackButton fallback="/health/exercises" />}
          eyebrow={muscleGroupLabel(exercise.primary_muscle)}
          title={exercise.name_ru}
          subtitle={exercise.name_en ?? undefined}
        />
        <HealthBody>
          {exercise.gif_url ? (
            <div className="workout-card" style={{ padding: 0 }}>
              <img
                src={exercise.gif_url}
                alt={exercise.name_ru}
                style={{ width: "100%", borderRadius: 16 }}
              />
            </div>
          ) : null}

          <SectionTitle>Параметры</SectionTitle>
          <div className="workout-card">
            <div className="workout-card-body">
              <div className="workout-card-metrics">
                {CATEGORY_LABEL[exercise.category] ?? exercise.category}
                {exercise.is_compound ? " · базовое" : " · изолированное"}
                {exercise.is_unilateral ? " · одностороннее" : ""}
                {exercise.difficulty
                  ? ` · ${DIFFICULTY_LABEL[exercise.difficulty]}`
                  : ""}
                {exercise.default_rest_seconds
                  ? ` · отдых ${exercise.default_rest_seconds}с`
                  : ""}
              </div>
            </div>
          </div>

          {exercise.equipment.length ? (
            <>
              <SectionTitle>Оборудование</SectionTitle>
              <div className="filter-chips" style={{ flexWrap: "wrap" }}>
                {exercise.equipment.map((eq) => (
                  <span key={eq} className="filter-chip is-on">
                    {EQUIPMENT_LABEL[eq] ?? eq}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {exercise.secondary_muscles.length ? (
            <>
              <SectionTitle>Дополнительные мышцы</SectionTitle>
              <div className="filter-chips" style={{ flexWrap: "wrap" }}>
                {exercise.secondary_muscles.map((m) => (
                  <span key={m} className="filter-chip">
                    {muscleGroupLabel(m)}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {exercise.instructions ? (
            <>
              <SectionTitle>Техника</SectionTitle>
              <div className="workout-card">
                <div className="workout-card-body">
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    {exercise.instructions}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </HealthBody>
      </HealthScreenLayout>
    </HealthApp>
  );
}
