import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Icon } from "../tasks/components/Icon";
import {
  addKpiHistoryEntry,
  createKpi,
  deleteKpi,
  listKpis,
} from "../../services/api";
import type { Kpi, KpiDirection } from "../../types/api";
import {
  GoalsBody,
  GoalsScreenLayout,
  GoalsTopBar,
  statusLabel,
} from "./components/shell";

function KpiCard({
  kpi,
  onRecord,
  onDelete,
}: {
  kpi: Kpi;
  onRecord: (value: number) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState<number | "">("");
  const spark = kpi.history.slice(-12);
  const max = Math.max(...spark.map((h) => h.value), 1);
  return (
    <div className="g-kpi">
      <div className="g-kpi__top">
        <div>
          <div className="g-kpi__name">{kpi.name}</div>
          <div className="g-kpi__value">
            <div className="g-kpi__value-num">{kpi.current_value ?? "—"}</div>
            {kpi.unit ? (
              <div className="g-kpi__value-unit">{kpi.unit}</div>
            ) : null}
          </div>
          <div className="g-kpi__target">
            Цель: {kpi.target_value ?? "—"}
            {kpi.unit ? ` ${kpi.unit}` : ""} ·{" "}
            {kpi.direction === "decrease"
              ? "уменьшить"
              : kpi.direction === "maintain"
                ? "удержать"
                : "увеличить"}
          </div>
        </div>
        <span className={`g-kpi__status ${kpi.status}`}>
          {statusLabel(kpi.status)}
        </span>
      </div>

      {spark.length > 0 ? (
        <div className="g-kpi__spark" aria-hidden="true">
          {spark.map((h, i) => (
            <i
              key={h.id}
              className={i === spark.length - 1 ? "active" : ""}
              style={{ height: `${(h.value / max) * 100}%` }}
            />
          ))}
        </div>
      ) : null}

      {kpi.trend_percent != null ? (
        <div
          className={`g-kpi__trend ${kpi.trend_percent >= 0 ? "up" : "down"}`}
        >
          {kpi.trend_percent >= 0 ? "▲" : "▼"} {Math.abs(kpi.trend_percent)}% за
          период
        </div>
      ) : null}

      <div className="g-kpi__add-history">
        <input
          type="number"
          aria-label={`Записать значение ${kpi.name}`}
          placeholder="Новое значение"
          value={value}
          onChange={(e) =>
            setValue(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
        <button
          type="button"
          className="g-btn tiny primary"
          disabled={value === ""}
          onClick={() => {
            if (value === "") return;
            onRecord(Number(value));
            setValue("");
          }}
        >
          Записать
        </button>
        <button
          type="button"
          className="g-btn tiny ghost"
          onClick={onDelete}
          aria-label={`Удалить ${kpi.name}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function KpiScreen() {
  const queryClient = useQueryClient();
  const kpisQuery = useQuery({
    queryKey: ["kpis"],
    queryFn: () => listKpis({ is_active: true }),
  });

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState<number | "">("");
  const [direction, setDirection] = useState<KpiDirection>("increase");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["kpis"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createKpi({
        name: name.trim(),
        unit: unit.trim() || undefined,
        target_value: target === "" ? undefined : Number(target),
        direction,
      }),
    onSuccess: () => {
      setName("");
      setUnit("");
      setTarget("");
      setDirection("increase");
      invalidate();
    },
  });

  const recordMutation = useMutation({
    mutationFn: ({ kpiId, value }: { kpiId: string; value: number }) =>
      addKpiHistoryEntry(kpiId, { value }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKpi(id),
    onSuccess: invalidate,
  });

  const kpis = kpisQuery.data ?? [];

  return (
    <GoalsScreenLayout>
      <GoalsTopBar back="/goals" title="KPI" eyebrow="5–20 метрик · тренды" />
      <GoalsBody>
        <section className="g-ai-chip">
          <div className="g-ai-dot">AI</div>
          <div style={{ flex: 1 }}>
            Выбери 5–10 главных метрик. Записывай значения регулярно — увидишь
            тренд и попадание в целевой коридор.
          </div>
          <Icon name="chart" size={14} color="#6E5BF6" />
        </section>

        {kpisQuery.isLoading ? <p className="g-empty">Загружаем KPI…</p> : null}

        {!kpisQuery.isLoading && kpis.length === 0 ? (
          <p className="g-empty">
            Пока нет KPI. Добавь первый — например «Шаги в день · 10000».
          </p>
        ) : null}

        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            kpi={kpi}
            onRecord={(value) =>
              recordMutation.mutate({ kpiId: kpi.id, value })
            }
            onDelete={() => {
              if (confirm(`Удалить «${kpi.name}»?`)) {
                deleteMutation.mutate(kpi.id);
              }
            }}
          />
        ))}

        <div className="g-form-card">
          <div className="g-field">
            <label className="g-field__label" htmlFor="kpi-name">
              Новый KPI
            </label>
            <input
              id="kpi-name"
              className="g-field__input"
              placeholder="Шаги в день"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="g-field__row">
            <div className="g-field">
              <label className="g-field__label" htmlFor="kpi-target">
                Цель
              </label>
              <input
                id="kpi-target"
                className="g-field__input"
                type="number"
                value={target}
                onChange={(e) =>
                  setTarget(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div className="g-field">
              <label className="g-field__label" htmlFor="kpi-unit">
                Единица
              </label>
              <input
                id="kpi-unit"
                className="g-field__input"
                placeholder="шагов / кг / ч"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="g-field">
            <span className="g-field__label">Направление</span>
            <div
              className="g-segmented"
              role="tablist"
              aria-label="Направление"
            >
              {(["increase", "decrease", "maintain"] as KpiDirection[]).map(
                (d) => (
                  <button
                    key={d}
                    type="button"
                    className={`g-segmented__btn ${direction === d ? "active" : ""}`}
                    onClick={() => setDirection(d)}
                  >
                    {d === "increase" ? "↑" : d === "decrease" ? "↓" : "≈"}
                  </button>
                ),
              )}
            </div>
          </div>
          <button
            type="button"
            className="g-btn primary"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Добавить KPI
          </button>
        </div>
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
