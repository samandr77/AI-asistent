import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import {
  getFinanceAnalytics,
  getFinanceDashboard,
  listFinanceIncome,
} from "../../services/api";
import type { FinanceIncome } from "../../types/api";
import { IncomeSheet } from "./components/forms";
import { Icon, type IconName } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Skeleton,
  centsToRub,
  fmt,
} from "./components/shell";

const SHORT_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

function incomeIcon(source: string, category: string): IconName {
  const s = (source + " " + category).toLowerCase();
  if (s.includes("зарплат") || s.includes("salary") || s.includes("работ"))
    return "briefcase";
  if (s.includes("фриланс") || s.includes("free") || s.includes("проект"))
    return "lightning";
  if (s.includes("аренд") || s.includes("rent")) return "house";
  if (
    s.includes("дивид") ||
    s.includes("invest") ||
    s.includes("инвест") ||
    s.includes("брокер")
  )
    return "trend-up";
  return "tag";
}

type MonthBucket = {
  key: string; // YYYY-MM
  label: string;
  amount: number;
};

function bucketByMonth(income: FinanceIncome[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const item of income) {
    const date = new Date(item.received_on);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = SHORT_MONTHS[date.getMonth()];
    const rub = centsToRub(item.amount_cents);
    const existing = map.get(key);
    if (existing) {
      existing.amount += rub;
    } else {
      map.set(key, { key, label, amount: rub });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function IncomeScreen(): ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false);
  const incomeQuery = useQuery({
    queryKey: ["finance", "income"],
    queryFn: listFinanceIncome,
  });
  const dashboardQuery = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: getFinanceDashboard,
  });
  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics"],
    queryFn: () => getFinanceAnalytics(),
  });

  const income = incomeQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;

  const monthlyIncome = centsToRub(dashboard?.monthly_income_cents);
  const monthlyExpense = centsToRub(dashboard?.monthly_expense_cents);
  const savings = Math.max(0, monthlyIncome - monthlyExpense);
  const savingsRate =
    monthlyIncome > 0 ? Math.round((savings / monthlyIncome) * 100) : 0;

  const months = useMemo(() => {
    const buckets = bucketByMonth(income);
    return buckets.slice(-6);
  }, [income]);

  const maxMonth = months.reduce((m, b) => Math.max(m, b.amount), 0);

  const sources = useMemo(() => {
    const map = new Map<
      string,
      { source: string; category: string; total: number }
    >();
    for (const item of income) {
      const rub = centsToRub(item.amount_cents);
      const existing = map.get(item.source);
      if (existing) {
        existing.total += rub;
      } else {
        map.set(item.source, {
          source: item.source,
          category: item.category,
          total: rub,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [income]);

  const totalIncomeAcross = sources.reduce((s, x) => s + x.total, 0);

  const isLoading = incomeQuery.isLoading;
  const hasError =
    incomeQuery.isError && !incomeQuery.data && !incomeQuery.isFetching;

  return (
    <FinancePhone title="Доходы" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="row between">
          <div className="hello">Доход за месяц</div>
          <Pill>
            6 месяцев <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Поступило
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={220} height={36} />
            ) : (
              fmt(monthlyIncome) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading
              ? "Загружаю доходы…"
              : savings > 0
                ? `Экономия ${fmt(savings)} ₽ · ${savingsRate}%`
                : "Дайте первый доход — увидите норму сбережения"}
          </div>
        </div>
        {months.length > 0 ? (
          <>
            <div className="bars" style={{ marginTop: 14, height: 70 }}>
              {months.map((m, i) => {
                const isLast = i === months.length - 1;
                const heightPct = maxMonth > 0 ? m.amount / maxMonth : 0;
                return (
                  <div
                    key={m.key}
                    className={"b" + (isLast ? " on" : "")}
                    style={{
                      height: heightPct * 70 + "px",
                      background: isLast ? "white" : "rgba(255,255,255,.32)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        bottom: -16,
                        left: 0,
                        right: 0,
                        textAlign: "center",
                        fontSize: 10,
                        color: "rgba(255,255,255,.7)",
                        fontWeight: 600,
                      }}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 22 }} />
          </>
        ) : null}
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void incomeQuery.refetch()}
            message="Не удалось загрузить доходы"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={64} />
            <div style={{ height: 10 }} />
            <Skeleton height={64} />
          </>
        ) : sources.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title="Доходов пока нет"
            description="Добавьте источник дохода — зарплату, фриланс или дивиденды."
          />
        ) : (
          <>
            <SectionTitle
              title="Источники"
              action={{
                label: "+ добавить",
                onClick: () => setSheetOpen(true),
              }}
              style={{ marginTop: 4 }}
            />
            <div className="card">
              {sources.map((src) => {
                const share =
                  totalIncomeAcross > 0
                    ? Math.round((src.total / totalIncomeAcross) * 100)
                    : 0;
                return (
                  <div className="src-row" key={src.source}>
                    <div className="ico green-soft">
                      <Icon
                        name={incomeIcon(src.source, src.category)}
                        size={16}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {src.source}
                      </div>
                      <div className="tiny mute">{src.category}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="num"
                        style={{
                          fontWeight: 800,
                          color: "var(--fin-green)",
                        }}
                      >
                        +{fmt(src.total)} ₽
                      </div>
                      <div className="tiny mute">{share}% дохода</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionTitle title="Доход vs Расход" />
            <div className="card big">
              <div className="kv" style={{ marginBottom: 10 }}>
                <span className="k">Поступило</span>
                <span className="v num" style={{ color: "var(--fin-green)" }}>
                  +{fmt(monthlyIncome)} ₽
                </span>
              </div>
              <div className="pbar thin">
                <i className="green" style={{ width: "100%" }} />
              </div>
              <div className="kv" style={{ marginTop: 14, marginBottom: 10 }}>
                <span className="k">Потрачено</span>
                <span className="v num">−{fmt(monthlyExpense)} ₽</span>
              </div>
              <div className="pbar thin">
                <i
                  style={{
                    width:
                      (monthlyIncome > 0
                        ? Math.min(100, (monthlyExpense / monthlyIncome) * 100)
                        : 0) + "%",
                    background: "var(--fin-red)",
                  }}
                />
              </div>
              <div
                className="kv"
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--fin-line)",
                }}
              >
                <span
                  className="k"
                  style={{ fontWeight: 800, color: "var(--fin-ink)" }}
                >
                  Остаётся (норма сбережения)
                </span>
                <span
                  className="num"
                  style={{
                    fontWeight: 800,
                    fontSize: 18,
                    color: "var(--fin-green)",
                  }}
                >
                  +{fmt(savings)} ₽ · {savingsRate}%
                </span>
              </div>
            </div>
            {analytics ? (
              <div className="tiny mute" style={{ marginTop: 8 }}>
                Период {analytics.period_start} — {analytics.period_end}
              </div>
            ) : null}
          </>
        )}
        <button
          type="button"
          className="btn full ghost"
          style={{ marginTop: 12 }}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить доход
        </button>
        <div style={{ height: 16 }} />
      </div>
      <IncomeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
