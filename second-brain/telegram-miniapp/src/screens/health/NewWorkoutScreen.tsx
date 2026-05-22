import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createWorkoutSession } from "../../services/api";
import type { SportKind, WorkoutSessionType } from "../../types/api";
import {
  HealthApp,
  HealthBackButton,
  HealthBody,
  HealthCta,
  HealthScreenLayout,
  HealthTopBar,
  SectionTitle,
} from "./components/shell";
import { HealthField } from "./components/Sheet";
import { Icon } from "./components/Icon";
import { SPORTS, STRENGTH_LABEL } from "./components/sports";

const STRENGTH_OPTION = {
  kind: null as SportKind | null,
  labelRu: STRENGTH_LABEL.labelRu,
  icon: STRENGTH_LABEL.icon,
  accent: STRENGTH_LABEL.accent,
  defaultSessionType: "strength" as WorkoutSessionType,
};

const PICKER_ORDER: (SportKind | null)[] = [
  null,
  "running",
  "cycling",
  "swim_pool",
  "yoga",
  "hiit",
  "row",
  "walking",
  "ski",
  "climb",
  "golf",
  "other",
];

function optionFor(kind: SportKind | null) {
  if (kind === null) return STRENGTH_OPTION;
  const meta = SPORTS[kind];
  return {
    kind: meta.kind,
    labelRu: meta.labelRu,
    icon: meta.icon,
    accent: meta.accent,
    defaultSessionType: meta.defaultSessionType,
  };
}

export function NewWorkoutScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<SportKind | null>(null);
  const [title, setTitle] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const opt = optionFor(picked);

  const mutation = useMutation({
    mutationFn: createWorkoutSession,
    onSuccess: async (session) => {
      await qc.invalidateQueries({ queryKey: ["health", "workouts"] });
      navigate(`/health/workouts/${session.id}/log`);
    },
  });

  function handleStart() {
    const finalTitle = title.trim() || opt.labelRu;
    mutation.mutate({
      session_type: opt.defaultSessionType,
      sport_kind: opt.kind,
      title: finalTitle,
      occurred_on: today,
    });
  }

  return (
    <HealthApp>
      <HealthScreenLayout>
        <HealthTopBar
          left={<HealthBackButton fallback="/health/workouts" />}
          eyebrow="Новая тренировка"
          title="Выбери тип"
        />
        <HealthBody>
          <SectionTitle>Спорт</SectionTitle>
          <div className="sport-picker">
            {PICKER_ORDER.map((kind) => {
              const o = optionFor(kind);
              const selected = picked === kind;
              return (
                <button
                  key={kind ?? "strength"}
                  type="button"
                  className="sport-picker-tile"
                  style={
                    selected
                      ? { boxShadow: `0 0 0 2px ${o.accent}` }
                      : undefined
                  }
                  onClick={() => setPicked(kind)}
                  aria-pressed={selected}
                >
                  <span
                    className="sport-picker-tile-icon"
                    style={{ background: o.accent }}
                  >
                    <Icon name={o.icon} size={20} />
                  </span>
                  <span className="sport-picker-tile-label">{o.labelRu}</span>
                </button>
              );
            })}
          </div>

          <SectionTitle>Название</SectionTitle>
          <HealthField
            label="Заголовок"
            hint="Если пусто — будет название спорта"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={opt.labelRu}
              maxLength={120}
            />
          </HealthField>

          <HealthCta onClick={handleStart} disabled={mutation.isPending}>
            <Icon name="play" size={18} />
            {mutation.isPending ? "Создаём…" : "Начать тренировку"}
          </HealthCta>
        </HealthBody>
      </HealthScreenLayout>
    </HealthApp>
  );
}
