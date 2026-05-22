import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteWorkoutSession,
  finishWorkoutSession,
  getWorkoutSession,
  listExercises,
} from "../../services/api";
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
import {
  formatDuration,
  sportAccent,
  sportLabel,
  muscleGroupLabel,
} from "./components/sports";
import { Icon } from "./components/Icon";

export function WorkoutDetailScreen() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["health", "workouts", workoutId],
    queryFn: () => getWorkoutSession(workoutId!),
    enabled: !!workoutId,
  });

  const { data: exercises } = useQuery({
    queryKey: ["health", "exercises"],
    queryFn: () => listExercises({ limit: 200 }),
    enabled: !!session?.sets && session.sets.length > 0,
  });

  const exerciseMap = new Map((exercises ?? []).map((e) => [e.id, e]));

  const finish = useMutation({
    mutationFn: () => finishWorkoutSession(workoutId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["health", "workouts"] });
    },
  });

  const del = useMutation({
    mutationFn: () => deleteWorkoutSession(workoutId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["health", "workouts"] });
      navigate("/health/workouts");
    },
  });

  if (isLoading) {
    return (
      <HealthApp>
        <HealthScreenLayout>
          <HealthTopBar left={<HealthBackButton />} title="Тренировка" />
          <HealthBody>
            <div className="health-empty">Загружаем…</div>
          </HealthBody>
        </HealthScreenLayout>
      </HealthApp>
    );
  }

  if (!session) {
    return (
      <HealthApp>
        <HealthScreenLayout>
          <HealthTopBar left={<HealthBackButton />} title="Не найдено" />
          <HealthBody>
            <EmptyState
              title="Сессия не найдена"
              description="Возможно, она была удалена."
            />
          </HealthBody>
        </HealthScreenLayout>
      </HealthApp>
    );
  }

  const accent = sportAccent(session.sport_kind);
  const sets = session.sets ?? [];

  // Group sets by exercise_id, preserving order of first appearance
  const groups: { exerciseId: string; sets: typeof sets }[] = [];
  for (const s of sets) {
    const g = groups.find((x) => x.exerciseId === s.exercise_id);
    if (g) g.sets.push(s);
    else groups.push({ exerciseId: s.exercise_id, sets: [s] });
  }

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={<HealthBackButton fallback="/health/workouts" />}
          right={
            <>
              {!session.is_completed ? (
                <Link
                  to={`/health/workouts/${session.id}/log`}
                  className="sport-chip"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="play" size={14} /> Логировать
                </Link>
              ) : null}
              <HealthIconButton
                name="trash"
                onClick={() => {
                  if (window.confirm("Удалить тренировку?")) del.mutate();
                }}
                label="Удалить"
              />
            </>
          }
          eyebrow={sportLabel(session.sport_kind)}
          title={session.title}
          subtitle={session.occurred_on}
        />
        <HealthBody>
          <div
            className="workout-card"
            style={{ ["--accent" as string]: accent } as React.CSSProperties}
          >
            <div className="workout-card-body">
              <div className="workout-card-title">Сводка</div>
              <div className="workout-card-metrics">
                {formatDuration(session.duration_minutes)}
                {session.rpe ? ` · RPE ${session.rpe}` : ""}
                {session.training_load_score
                  ? ` · нагрузка ${Math.round(session.training_load_score)}`
                  : ""}
                {session.intensity_minutes
                  ? ` · ${session.intensity_minutes} мин активности`
                  : ""}
              </div>
            </div>
            <div className="workout-card-status">
              {session.is_completed ? "✓" : "•"}
            </div>
          </div>

          {sets.length > 0 ? (
            <>
              <SectionTitle>Упражнения · {groups.length}</SectionTitle>
              {groups.map((g) => {
                const ex = exerciseMap.get(g.exerciseId);
                return (
                  <div key={g.exerciseId} className="exercise-row">
                    <div className="exercise-row-head">
                      <div>
                        <div className="exercise-row-name">
                          {ex?.name_ru ?? "Упражнение"}
                        </div>
                        {ex ? (
                          <div className="exercise-row-muscle">
                            {muscleGroupLabel(ex.primary_muscle)}
                          </div>
                        ) : null}
                      </div>
                      <div className="workout-card-metrics">
                        {g.sets.length} × подходов
                      </div>
                    </div>
                    <div className="exercise-row-sets">
                      {g.sets.map((s) => (
                        <div key={s.id} className="set-row" aria-readonly>
                          <div className="set-row-num">
                            {s.is_warmup ? "W" : s.set_number}
                          </div>
                          <div className="set-row-input">
                            {s.weight_kg != null ? `${s.weight_kg}` : "—"}
                          </div>
                          <span className="set-row-x">×</span>
                          <div className="set-row-input">
                            {s.reps != null ? `${s.reps}` : "—"}
                          </div>
                          <div className="set-row-input set-row-input--rpe">
                            {s.rpe != null ? `RPE${s.rpe}` : ""}
                          </div>
                          <span />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <EmptyState
              title="Подходы не залогированы"
              description="Открой режим записи и добавь подходы."
              action={
                !session.is_completed ? (
                  <HealthCta
                    onClick={() =>
                      navigate(`/health/workouts/${session.id}/log`)
                    }
                  >
                    <Icon name="play" size={18} /> Логировать
                  </HealthCta>
                ) : null
              }
            />
          )}

          {!session.is_completed ? (
            <HealthCta
              variant="primary"
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
            >
              <Icon name="check" size={18} />
              {finish.isPending ? "Завершаем…" : "Завершить тренировку"}
            </HealthCta>
          ) : null}
        </HealthBody>
      </HealthScreenLayout>
    </HealthApp>
  );
}
