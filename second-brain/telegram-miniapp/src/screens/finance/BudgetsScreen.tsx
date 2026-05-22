import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import {
  getFinanceAnalytics,
  getFinanceBudgetTemplate,
  getFinanceDashboard,
  listFinanceBudgetEnvelopes,
  listFinanceBudgets,
} from "../../services/api";
import { BudgetSheet } from "./components/forms";
import { Icon } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  Segmented,
  Skeleton,
  categoryIcon,
  categoryLabel,
  centsToRub,
  fmt,
} from "./components/shell";

export function BudgetsScreen(): ReactNode {
  const [period, setPeriod] = useState("month");
  const [sheetOpen, setSheetOpen] = useState(false);

  const budgetsQuery = useQuery({
    queryKey: ["finance", "budgets"],
    queryFn: listFinanceBudgets,
  });
  const envelopesQuery = useQuery({
    queryKey: ["finance", "budget-envelopes"],
    queryFn: listFinanceBudgetEnvelopes,
  });
  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics"],
    queryFn: () => getFinanceAnalytics(),
  });
  const dashboardQuery = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: getFinanceDashboard,
  });
  const templateQuery = useQuery({
    queryKey: ["finance", "budget-template"],
    queryFn: () => getFinanceBudgetTemplate({ months: 3 }),
  });

  const budgets = budgetsQuery.data ?? [];
  const envelopes = envelopesQuery.data ?? [];
  const analytics = analyticsQuery.data;
  const dashboard = dashboardQuery.data;
  const template = templateQuery.data;

  const categoryToSpent = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of analytics?.by_category ?? []) {
      map.set(item.category, centsToRub(item.expense_cents));
    }
    return map;
  }, [analytics]);

  const items = (
    envelopes.length > 0
      ? envelopes
          .filter((b) =>
            period === "month" ? b.period === "monthly" : b.period === "weekly",
          )
          .map((b) => ({
            id: b.budget_id,
            category: b.category,
            limit: centsToRub(b.allocated_cents),
            spent: centsToRub(b.spent_cents),
            rollover: centsToRub(b.rollover_cents),
            status: b.status,
          }))
      : budgets
          .filter((b) =>
            period === "month" ? b.period === "monthly" : b.period === "weekly",
          )
          .map((b) => ({
            id: b.id,
            category: b.category,
            limit: centsToRub(
              (b.allocated_cents ?? b.limit_cents) +
                (b.rollover_enabled ? (b.rollover_cents ?? 0) : 0),
            ),
            spent: categoryToSpent.get(b.category) ?? 0,
            rollover: centsToRub(b.rollover_cents ?? 0),
            status: "ok",
          }))
  );

  const totalSpent = items.reduce((sum, b) => sum + b.spent, 0);
  const totalLimit = items.reduce((sum, b) => sum + b.limit, 0);
  const totalPct =
    totalLimit > 0
      ? Math.min(100, Math.round((totalSpent / totalLimit) * 100))
      : 0;
  const remaining = Math.max(0, totalLimit - totalSpent);

  const isLoading =
    budgetsQuery.isLoading ||
    analyticsQuery.isLoading ||
    (envelopesQuery.isLoading && budgets.length === 0);
  const hasError =
    budgetsQuery.isError && !budgetsQuery.data && !budgetsQuery.isFetching;

  const monthLabel = "на этот период";
  const currency = dashboard?.currency ?? "RUB";
  void currency;

  return (
    <FinancePhone title="Бюджет" activeTab="budgets" backTo="/finance">
      <div className="red-head">
        <div className="row between">
          <div className="hello">Лимиты {monthLabel}</div>
          <Pill>
            {period === "month" ? "По месяцу" : "По неделе"}{" "}
            <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        <div
          className="row between"
          style={{ marginTop: 14, alignItems: "flex-end" }}
        >
          <div>
            <div
              className="label"
              style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
            >
              Потрачено / Лимит
            </div>
            <div
              className="num"
              style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}
            >
              {isLoading ? (
                <Skeleton width={200} height={30} />
              ) : (
                <>
                  {fmt(totalSpent)}{" "}
                  <span style={{ opacity: 0.6 }}>/ {fmt(totalLimit)} ₽</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div
          className="pbar thin"
          style={{ marginTop: 10, background: "rgba(255,255,255,.2)" }}
        >
          <i className="white" style={{ width: totalPct + "%" }} />
        </div>
        <div className="sub" style={{ marginTop: 8 }}>
          {totalLimit > 0 ? (
            <>
              Осталось <b className="num">{fmt(remaining)} ₽</b> · {totalPct}%
              лимита использовано
            </>
          ) : (
            "Задайте бюджеты, чтобы видеть прогресс"
          )}
        </div>
      </div>

      <div className="scroll">
        <Segmented
          items={[
            { key: "month", label: "Месяц" },
            { key: "week", label: "Неделя" },
          ]}
          active={period}
          onChange={setPeriod}
        />

        <div style={{ height: 12 }} />

        {hasError ? (
          <ErrorState
            onRetry={() => void budgetsQuery.refetch()}
            message="Не удалось загрузить бюджеты"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={88} />
            <div style={{ height: 10 }} />
            <Skeleton height={88} />
            <div style={{ height: 10 }} />
            <Skeleton height={88} />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="Бюджетов пока нет"
            description="Добавьте лимит на категорию — увидите прогресс расходов в реальном времени."
          />
        ) : (
          items.map((b) => {
            const over = b.status === "over" || b.spent > b.limit;
            const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
            const barColor = over
              ? "var(--fin-red)"
              : pct > 85
                ? "var(--fin-amber)"
                : "var(--fin-red)";
            return (
              <div className="card" key={b.id} style={{ marginBottom: 10 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="row gap">
                    <div className="ico red-soft">
                      <Icon name={categoryIcon(b.category)} size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {categoryLabel(b.category)}
                      </div>
                      <div className="tiny mute">
                        {over ? (
                          <span
                            style={{
                              color: "var(--fin-red)",
                              fontWeight: 700,
                            }}
                          >
                            Превышено на {fmt(b.spent - b.limit)} ₽
                          </span>
                        ) : (
                          `Осталось ${fmt(Math.max(0, b.limit - b.spent))} ₽`
                        )}
                        {b.rollover > 0 ? ` · перенос ${fmt(b.rollover)} ₽` : ""}
                      </div>
                    </div>
                  </div>
                  <div
                    className="num"
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: over ? "var(--fin-red)" : "var(--fin-ink)",
                    }}
                  >
                    {fmt(b.spent)}{" "}
                    <span className="mute small" style={{ fontWeight: 600 }}>
                      / {fmt(b.limit)}
                    </span>
                  </div>
                </div>
                <div className="pbar thin">
                  <i
                    style={{
                      width: Math.min(pct, 100) + "%",
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}

        {template && template.items.length > 0 ? (
          <div
            className="card"
            style={{
              marginTop: 14,
              background: "var(--fin-ink)",
              color: "white",
            }}
          >
            <div className="row gap">
              <div
                className="ico"
                style={{ background: "rgba(255,255,255,.14)" }}
              >
                <Icon name="sparkles" size={16} stroke="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>Шаблон от ассистента</div>
                <div className="small" style={{ opacity: 0.75, marginTop: 2 }}>
                  Бюджет на основе средних трат за последние{" "}
                  {template.period_months} мес ({template.items.length}{" "}
                  категорий)
                </div>
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  background: "white",
                  color: "var(--fin-ink)",
                  boxShadow: "none",
                  padding: "10px 14px",
                }}
              >
                Применить
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="btn full ghost"
          style={{ marginTop: 12 }}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить бюджет
        </button>
        <div style={{ height: 16 }} />
      </div>
      <BudgetSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
