import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { getFinanceAnalytics, getFinanceForecast } from "../../services/api";
import type { FinanceAnalytics } from "../../types/api";
import { Icon } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Segmented,
  Skeleton,
  categoryLabel,
  centsToRub,
  fmt,
} from "./components/shell";

const CATEGORY_COLORS = [
  "#E63946",
  "#1F1A17",
  "#E89B2B",
  "#2F6FE0",
  "#2EA86A",
  "#B5283A",
  "#8A7E76",
];

function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}): ReactNode {
  return (
    <div
      className="row gap"
      style={{ fontSize: 11, color: "var(--fin-mute)", fontWeight: 700 }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 2, background: color }}
      />{" "}
      {label}
    </div>
  );
}

function CashFlowChart({
  daily,
}: {
  daily: FinanceAnalytics["daily"];
}): ReactNode {
  const sorted = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return null;
  const limit = Math.min(sorted.length, 30);
  const items = sorted.slice(-limit);
  const max = items.reduce(
    (m, d) => Math.max(m, centsToRub(d.expense_cents)),
    1,
  );
  const w = 280;
  const h = 120;
  const slot = w / items.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 24}`}
      style={{ width: "100%" }}
      aria-label="Расходы по дням"
    >
      {items.map((d, i) => {
        const value = centsToRub(d.expense_cents);
        const eh = (value / max) * h;
        const x = i * slot + 3;
        const bw = Math.max(slot - 6, 2);
        return (
          <rect
            key={d.date}
            x={x}
            y={h - eh}
            width={bw}
            height={eh}
            rx={2}
            fill="#E63946"
            opacity=".85"
          />
        );
      })}
      <line x1={0} y1={h} x2={w} y2={h} stroke="#ECE2D7" strokeWidth="1" />
      {[0, Math.floor(items.length / 2), items.length - 1]
        .filter((idx, i, arr) => arr.indexOf(idx) === i)
        .map((idx) => {
          const d = items[idx];
          if (!d) return null;
          const day = new Date(d.date).getDate();
          return (
            <text
              key={`lbl-${idx}`}
              x={idx * slot + 5}
              y={h + 16}
              fontSize="9"
              fill="#8A7E76"
              fontWeight="700"
            >
              {day}
            </text>
          );
        })}
    </svg>
  );
}

export function AnalyticsScreen(): ReactNode {
  const [period, setPeriod] = useState("month");

  const range = useMemo(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now);
    if (period === "week") from.setDate(from.getDate() - 7);
    else if (period === "quarter") from.setMonth(from.getMonth() - 3);
    else if (period === "year") from.setFullYear(from.getFullYear() - 1);
    else from.setMonth(from.getMonth() - 1);
    return { date_from: from.toISOString().slice(0, 10), date_to: to };
  }, [period]);

  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics", period],
    queryFn: () => getFinanceAnalytics(range),
  });
  const forecastQuery = useQuery({
    queryKey: ["finance", "forecast"],
    queryFn: () => getFinanceForecast({ months: 3 }),
  });

  const analytics = analyticsQuery.data;
  const forecast = forecastQuery.data;

  const categories = useMemo(() => {
    if (!analytics) return [];
    const total = analytics.expense_cents || 1;
    return [...analytics.by_category]
      .sort((a, b) => b.expense_cents - a.expense_cents)
      .slice(0, 7)
      .map((item, index) => ({
        category: item.category,
        amount: centsToRub(item.expense_cents),
        pct: Math.round((item.expense_cents / total) * 100),
        color: categoryColor(index),
      }));
  }, [analytics]);

  const conic = useMemo(() => {
    if (categories.length === 0) return "var(--fin-cream-2) 0% 100%";
    let acc = 0;
    return categories
      .map((c) => {
        const from = acc;
        acc += c.pct;
        return `${c.color} ${from}% ${acc}%`;
      })
      .join(", ");
  }, [categories]);

  const totalExpense = centsToRub(analytics?.expense_cents);
  const isLoading = analyticsQuery.isLoading;
  const hasError =
    analyticsQuery.isError &&
    !analyticsQuery.data &&
    !analyticsQuery.isFetching;

  const periodLabel =
    period === "week"
      ? "Неделя"
      : period === "quarter"
        ? "Квартал"
        : period === "year"
          ? "Год"
          : "Месяц";

  return (
    <FinancePhone title="Аналитика" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="row between">
          <div className="hello">{periodLabel}</div>
          <Pill>
            {periodLabel} <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Расход за период
          </div>
          <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={220} height={32} />
            ) : (
              fmt(totalExpense) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading
              ? "Считаю аналитику…"
              : analytics
                ? `Кэш-флоу ${fmt(centsToRub(analytics.cash_flow_cents))} ₽`
                : ""}
          </div>
        </div>
      </div>

      <div className="scroll">
        <Segmented
          items={[
            { key: "week", label: "Неделя" },
            { key: "month", label: "Месяц" },
            { key: "quarter", label: "Квартал" },
            { key: "year", label: "Год" },
          ]}
          active={period}
          onChange={setPeriod}
        />
        <div style={{ height: 12 }} />

        {hasError ? (
          <ErrorState
            onRetry={() => void analyticsQuery.refetch()}
            message="Не удалось загрузить аналитику"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={170} />
            <div style={{ height: 12 }} />
            <Skeleton height={170} />
          </>
        ) : !analytics || categories.length === 0 ? (
          <EmptyState
            icon="chart"
            title="Данных для аналитики пока мало"
            description="Аналитика появится после первых операций по разным категориям."
          />
        ) : (
          <>
            <div className="card big">
              <div className="row between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Расходы по дням</div>
                  <div className="tiny mute">
                    {analytics.period_start} — {analytics.period_end}
                  </div>
                </div>
                <div className="row gap">
                  <LegendDot color="var(--fin-red)" label="расход" />
                </div>
              </div>
              {analytics.daily.length > 0 ? (
                <CashFlowChart daily={analytics.daily} />
              ) : (
                <div className="tiny mute" style={{ padding: "8px 0" }}>
                  Дневной разрез появится после нескольких операций.
                </div>
              )}
            </div>

            <SectionTitle title="По категориям" action={{ label: "список" }} />
            <div className="card big">
              <div className="donut-wrap">
                <div
                  style={{
                    width: 124,
                    height: 124,
                    borderRadius: "50%",
                    background: `conic-gradient(${conic})`,
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 14,
                      borderRadius: "50%",
                      background: "white",
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <div className="tiny mute" style={{ fontWeight: 700 }}>
                        всего
                      </div>
                      <div
                        className="num"
                        style={{ fontSize: 17, fontWeight: 800 }}
                      >
                        {fmt(totalExpense)} ₽
                      </div>
                    </div>
                  </div>
                </div>
                <div className="donut-legend">
                  {categories.map((c) => (
                    <div className="row between" key={c.category}>
                      <div className="row gap">
                        <span className="dot" style={{ background: c.color }} />
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          {categoryLabel(c.category)}
                        </span>
                      </div>
                      <span className="num small" style={{ fontWeight: 700 }}>
                        {c.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SectionTitle title="Топ категорий" />
            <div className="card">
              {categories.slice(0, 5).map((c) => (
                <div className="tx" key={c.category}>
                  <div
                    className="ico sm"
                    style={{ background: c.color + "26", color: c.color }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: c.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {categoryLabel(c.category)}
                    </div>
                    <div className="tiny mute">{c.pct}% расходов</div>
                  </div>
                  <div className="num" style={{ fontWeight: 800 }}>
                    {fmt(c.amount)} ₽
                  </div>
                </div>
              ))}
            </div>

            <SectionTitle title="Прогноз месяца" />
            <div className="card">
              {forecastQuery.isLoading ? (
                <Skeleton height={88} />
              ) : forecast && forecast.categories.length > 0 ? (
                <>
                  <div className="row between" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {fmt(
                          centsToRub(forecast.total_predicted_expense_cents),
                        )}{" "}
                        ₽
                      </div>
                      <div className="tiny mute">
                        ожидаемые расходы к концу месяца
                      </div>
                    </div>
                    <div
                      className={`ico ${forecast.total_predicted_overrun_cents > 0 ? "red" : "green-soft"}`}
                    >
                      <Icon
                        name={
                          forecast.total_predicted_overrun_cents > 0
                            ? "bell"
                            : "trend-up"
                        }
                        size={16}
                        stroke={
                          forecast.total_predicted_overrun_cents > 0
                            ? "white"
                            : undefined
                        }
                      />
                    </div>
                  </div>
                  {forecast.categories.slice(0, 3).map((item) => (
                    <div className="tx" key={item.category}>
                      <div className="ico sm amber-soft">
                        <Icon name="sparkles" size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {categoryLabel(item.category)}
                        </div>
                        <div className="tiny mute">
                          среднее {fmt(centsToRub(item.average_monthly_spend_cents))} ₽
                        </div>
                      </div>
                      <div className="num" style={{ fontWeight: 800 }}>
                        {fmt(centsToRub(item.predicted_month_end_cents))} ₽
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="tiny mute">
                  Прогноз появится после истории расходов за несколько недель.
                </div>
              )}
            </div>
          </>
        )}
        <div style={{ height: 16 }} />
      </div>
    </FinancePhone>
  );
}
