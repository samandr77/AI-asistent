import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWorkoutSet,
  deleteWorkoutSet,
  finishWorkoutSession,
  getWorkoutSession,
  listExercises,
  startWorkoutSession,
  updateWorkoutSet,
} from "../../services/api";
import { useActiveWorkoutStore } from "../../store/useActiveWorkoutStore";
import type {
  Exercise,
  WorkoutSet,
  WorkoutSetCreate,
  WorkoutSetUpdate,
} from "../../types/api";
import {
  HealthApp,
  HealthBackButton,
  HealthBody,
  HealthCta,
  HealthIconButton,
  HealthScreenLayout,
  HealthTopBar,
  SectionTitle,
} from "./components/shell";
import { HealthSheet, HealthField } from "./components/Sheet";
import { Icon } from "./components/Icon";
import { SetRow } from "./components/SetRow";
import { RestTimer } from "./components/RestTimer";
import { muscleGroupLabel } from "./components/sports";

function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: exercises } = useQuery({
    queryKey: ["health", "exercises", { search }],
    queryFn: () => listExercises({ search: search || undefined, limit: 50 }),
    enabled: open,
  });
  return (
    <HealthSheet open={open} onClose={onClose} title="Добавить упражнение">
      <HealthField label="Поиск" hint="по названию или slug">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="жим, присед…"
          autoFocus
        />
      </HealthField>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(exercises ?? []).map((ex) => (
          <button
            key={ex.id}
            type="button"
            className="exercise-list-row"
            onClick={() => {
              onPick(ex);
              onClose();
            }}
          >
            <div className="exercise-list-row-body">
              <div className="exercise-list-row-name">{ex.name_ru}</div>
              <div className="exercise-list-row-meta">
                {muscleGroupLabel(ex.primary_muscle)}
                {ex.equipment.length ? ` · ${ex.equipment.join(", ")}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </HealthSheet>
  );
}

export function LiveSessionScreen() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const startStore = useActiveWorkoutStore((s) => s.start);
  const stopStore = useActiveWorkoutStore((s) => s.stop);
  const startRestTimer = useActiveWorkoutStore((s) => s.startRestTimer);
  const autoRest = useActiveWorkoutStore((s) => s.autoRestEnabled);
  const setAutoRest = useActiveWorkoutStore((s) => s.setAutoRest);

  const { data: session, refetch } = useQuery({
    queryKey: ["health", "workouts", workoutId],
    queryFn: () => getWorkoutSession(workoutId!),
    enabled: !!workoutId,
  });

  const { data: exercises } = useQuery({
    queryKey: ["health", "exercises"],
    queryFn: () => listExercises({ limit: 200 }),
  });
  const exerciseMap = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id, e])),
    [exercises],
  );

  // On mount: register active session in zustand, hit /start if not started
  useEffect(() => {
    if (!session) return;
    startStore({
      sessionId: session.id,
      sportKind: session.sport_kind ?? null,
    });
    if (!session.started_at && !session.is_completed) {
      startWorkoutSession(session.id).then(() =>
        qc.invalidateQueries({ queryKey: ["health", "workouts", session.id] }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const sets = session?.sets ?? [];
  const groups: { exerciseId: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    const g = groups.find((x) => x.exerciseId === s.exercise_id);
    if (g) g.sets.push(s);
    else groups.push({ exerciseId: s.exercise_id, sets: [s] });
  }

  const addSet = useMutation({
    mutationFn: (payload: WorkoutSetCreate) =>
      createWorkoutSet(session!.id, payload),
    onSuccess: async (created) => {
      await refetch();
      await qc.invalidateQueries({
        queryKey: ["health", "workouts", "active"],
      });
      if (autoRest) {
        const ex = exerciseMap.get(created.exercise_id);
        const rest = ex?.default_rest_seconds ?? 90;
        startRestTimer(rest, created.id);
      }
    },
  });

  const editSet = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WorkoutSetUpdate }) =>
      updateWorkoutSet(id, patch),
    onSuccess: () => refetch(),
  });

  const removeSet = useMutation({
    mutationFn: (id: string) => deleteWorkoutSet(id),
    onSuccess: () => refetch(),
  });

  const finish = useMutation({
    mutationFn: () => finishWorkoutSession(session!.id),
    onSuccess: async () => {
      stopStore();
      await qc.invalidateQueries({ queryKey: ["health", "workouts"] });
      navigate(`/health/workouts/${session!.id}`);
    },
  });

  function handlePick(exercise: Exercise) {
    const sameExerciseSets = sets.filter((s) => s.exercise_id === exercise.id);
    const nextNumber = sameExerciseSets.length + 1;
    const prev = sameExerciseSets[sameExerciseSets.length - 1];
    addSet.mutate({
      exercise_id: exercise.id,
      set_number: nextNumber,
      reps: prev?.reps ?? null,
      weight_kg: prev?.weight_kg ?? null,
      rpe: prev?.rpe ?? null,
    });
  }

  function handleAddSetToGroup(exerciseId: string) {
    const sameExerciseSets = sets.filter((s) => s.exercise_id === exerciseId);
    const nextNumber = sameExerciseSets.length + 1;
    const prev = sameExerciseSets[sameExerciseSets.length - 1];
    addSet.mutate({
      exercise_id: exerciseId,
      set_number: nextNumber,
      reps: prev?.reps ?? null,
      weight_kg: prev?.weight_kg ?? null,
      rpe: prev?.rpe ?? null,
    });
  }

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={
            <HealthBackButton
              fallback={
                session ? `/health/workouts/${session.id}` : "/health/workouts"
              }
            />
          }
          right={
            <HealthIconButton
              name="stopwatch"
              onClick={() => setAutoRest(!autoRest)}
              label="Авто-таймер отдыха"
              active={autoRest}
            />
          }
          eyebrow="Идёт тренировка"
          title={session?.title ?? "…"}
        />
        <HealthBody>
          <RestTimer />

          {groups.length === 0 ? (
            <div className="health-empty">
              <div className="health-empty-title">Добавь первое упражнение</div>
              <div className="health-empty-desc">
                Выбери упражнение из библиотеки и логируй подходы.
              </div>
              <div className="health-empty-action">
                <HealthCta onClick={() => setPickerOpen(true)}>
                  <Icon name="plus" size={18} /> Добавить упражнение
                </HealthCta>
              </div>
            </div>
          ) : (
            <>
              <SectionTitle
                action={
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--green-deep)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    + Упражнение
                  </button>
                }
              >
                Подходы
              </SectionTitle>
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
                    </div>
                    <div className="exercise-row-sets">
                      {g.sets.map((s) => (
                        <SetRow
                          key={s.id}
                          set={s}
                          onChange={(patch) =>
                            editSet.mutate({ id: s.id, patch })
                          }
                          onDelete={() => removeSet.mutate(s.id)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="exercise-row-add"
                      onClick={() => handleAddSetToGroup(g.exerciseId)}
                      disabled={addSet.isPending}
                    >
                      + Подход
                    </button>
                  </div>
                );
              })}
            </>
          )}

          <HealthCta
            variant="primary"
            onClick={() => finish.mutate()}
            disabled={finish.isPending || !session}
          >
            <Icon name="check" size={18} />
            {finish.isPending ? "Завершаем…" : "Завершить тренировку"}
          </HealthCta>
        </HealthBody>
      </HealthScreenLayout>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </HealthApp>
  );
}
