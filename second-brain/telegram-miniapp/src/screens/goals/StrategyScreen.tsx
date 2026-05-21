import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Icon } from "../tasks/components/Icon";
import { getStrategy, updateStrategy } from "../../services/api";
import type { Strategy } from "../../types/api";
import { GoalsBody, GoalsScreenLayout, GoalsTopBar } from "./components/shell";

type ChipKey =
  | "values"
  | "life_areas"
  | "swot_strengths"
  | "swot_weaknesses"
  | "swot_opportunities"
  | "swot_threats";

const CHIP_FIELDS: { key: ChipKey; label: string; placeholder: string }[] = [
  { key: "values", label: "Ценности", placeholder: "Свобода, рост, забота" },
  {
    key: "life_areas",
    label: "Сферы жизни",
    placeholder: "Работа, семья, здоровье",
  },
  {
    key: "swot_strengths",
    label: "SWOT · Сильные стороны",
    placeholder: "Дисциплина",
  },
  {
    key: "swot_weaknesses",
    label: "SWOT · Слабые стороны",
    placeholder: "Прокрастинация",
  },
  {
    key: "swot_opportunities",
    label: "SWOT · Возможности",
    placeholder: "AI-инструменты",
  },
  { key: "swot_threats", label: "SWOT · Угрозы", placeholder: "Выгорание" },
];

function ChipsField({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v) return;
    if (values.includes(v)) {
      setInput("");
      return;
    }
    onChange([...values, v]);
    setInput("");
  }
  return (
    <div className="g-field">
      <span className="g-field__label">{label}</span>
      <div className="g-chips">
        {values.map((v) => (
          <span key={v} className="g-chip">
            {v}
            <button
              type="button"
              className="g-chip__remove"
              aria-label={`Удалить ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="g-field__input"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="g-btn ghost" onClick={add}>
          +
        </button>
      </div>
    </div>
  );
}

export function StrategyScreen() {
  const queryClient = useQueryClient();
  const strategyQuery = useQuery({
    queryKey: ["strategy"],
    queryFn: getStrategy,
  });
  const [state, setState] = useState<Strategy | null>(null);

  useEffect(() => {
    if (strategyQuery.data && !state) {
      setState(strategyQuery.data);
    }
  }, [strategyQuery.data, state]);

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Omit<Strategy, "user_id">>) =>
      updateStrategy(body),
    onSuccess: (updated) => {
      setState(updated);
      queryClient.setQueryData(["strategy"], updated);
    },
  });

  if (!state) {
    return (
      <GoalsScreenLayout>
        <GoalsTopBar
          back="/goals"
          title="Стратегия"
          eyebrow="Миссия · Видение · SWOT"
        />
        <GoalsBody>
          <p className="g-empty">Загружаем стратегию…</p>
        </GoalsBody>
      </GoalsScreenLayout>
    );
  }

  function patch<K extends keyof Strategy>(key: K, value: Strategy[K]) {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <GoalsScreenLayout>
      <GoalsTopBar
        back="/goals"
        title="Стратегия"
        eyebrow="Миссия · Видение · SWOT"
      />
      <GoalsBody>
        <section className="g-ai-chip">
          <div className="g-ai-dot">AI</div>
          <div style={{ flex: 1 }}>
            Сильная стратегия — это видение, ценности и честный SWOT. От них
            растёт OKR-дерево.
          </div>
          <Icon name="sparkle" size={14} color="#6E5BF6" />
        </section>

        <div className="g-form-card">
          <div className="g-field">
            <label className="g-field__label" htmlFor="strategy-mission">
              Миссия
            </label>
            <textarea
              id="strategy-mission"
              className="g-field__textarea"
              maxLength={2000}
              placeholder="Зачем я живу и работаю — одной строкой"
              value={state.mission ?? ""}
              onChange={(e) => patch("mission", e.target.value)}
            />
          </div>
          <div className="g-field">
            <label className="g-field__label" htmlFor="strategy-vision">
              Видение (10 лет)
            </label>
            <textarea
              id="strategy-vision"
              className="g-field__textarea"
              maxLength={2000}
              placeholder="Каким я хочу быть через 10 лет"
              value={state.vision ?? ""}
              onChange={(e) => patch("vision", e.target.value)}
            />
          </div>

          {CHIP_FIELDS.map((f) => (
            <ChipsField
              key={f.key}
              label={f.label}
              values={state[f.key] as string[]}
              placeholder={f.placeholder}
              onChange={(next) => patch(f.key, next as Strategy[ChipKey])}
            />
          ))}

          <button
            type="button"
            className="g-btn primary lg g-btn--full"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                mission: state.mission ?? null,
                vision: state.vision ?? null,
                values: state.values,
                life_areas: state.life_areas,
                swot_strengths: state.swot_strengths,
                swot_weaknesses: state.swot_weaknesses,
                swot_opportunities: state.swot_opportunities,
                swot_threats: state.swot_threats,
              })
            }
          >
            {saveMutation.isPending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
