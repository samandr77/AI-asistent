import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  getFinanceAnalytics,
  getFinanceDashboard,
  listFinanceRecommendations,
} from "../../services/api";
import type {
  FinanceAlert,
  FinanceRecommendation,
  FinanceTransaction,
} from "../../types/api";
import { TransactionSheet } from "./components/forms";
import { Icon, type IconName } from "./components/Icon";
import {
  Alert,
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Skeleton,
  categoryIcon,
  categoryLabel,
  centsToRub,
  fmt,
  fmtCentsRub,
} from "./components/shell";

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTHS_RU[now.getMonth()]} ${now.getFullYear()}`;
}

function alertTone(
  severity: FinanceAlert["severity"] | FinanceRecommendation["severity"],
): "warning" | "danger" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function alertIconBg(
  severity: FinanceAlert["severity"] | FinanceRecommendation["severity"],
): "red" | "amber-soft" | "blue-soft" {
  if (severity === "critical") return "red";
  if (severity === "warning") return "amber-soft";
  return "blue-soft";
}

function alertIconStroke(
  severity: FinanceAlert["severity"] | FinanceRecommendation["severity"],
): string | undefined {
  return severity === "critical" ? "white" : undefined;
}

function alertIcon(kind: string): IconName {
  const k = kind.toLowerCase();
  if (k.includes("budget") || k.includes("cafe") || k.includes("food"))
    return "cart";
  if (k.includes("sub")) return "refresh";
  if (k.includes("goal") || k.includes("savings")) return "piggy";
  if (k.includes("debt") || k.includes("credit")) return "card";
  if (k.includes("tax")) return "calendar";
  return "sparkles";
}

type TileProps = {
  icon: IconName;
  label: string;
  tone: "red" | "red-soft";
  to?: string;
  onClick?: () => void;
};

function Tile({ icon, label, tone, to, onClick }: TileProps): ReactNode {
  const inner = (
    <>
      <div className={`ico ${tone}`}>
        <Icon
          name={icon}
          size={16}
          stroke={tone === "red" ? "white" : undefined}
        />
      </div>
      {label}
    </>
  );
  if (to) {
    return (
      <Link className="tile" to={to}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="tile" onClick={onClick}>
      {inner}
    </button>
  );
}

type CatRowProps = {
  icon: IconName;
  name: string;
  amount: number;
  limit: number;
};

function CatRow({ icon, name, amount, limit }: CatRowProps): ReactNode {
  const over = limit > 0 && amount > limit;
  const pct = limit > 0 ? Math.round((amount / limit) * 100) : 0;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="row gap">
          <div
            className={`ico sm ${over ? "red" : "red-soft"}`}
            style={over ? { color: "white" } : undefined}
          >
            <Icon
              name={icon}
              size={14}
              stroke={over ? "white" : "currentColor"}
            />
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
        </div>
        <div
          className="num small"
          style={{
            fontWeight: 800,
            color: over ? "var(--fin-red)" : "var(--fin-ink)",
          }}
        >
          {fmt(amount)}{" "}
          <span className="mute small" style={{ fontWeight: 600 }}>
            / {fmt(limit)} ₽
          </span>
        </div>
      </div>
      <div className="pbar thin">
        <i
          style={{
            width: Math.min(pct, 100) + "%",
            background: "var(--fin-red)",
          }}
        />
      </div>
    </div>
  );
}

type TxRowProps = {
  icon: IconName;
  iconBg: "red-soft" | "green-soft" | "amber-soft" | "blue-soft";
  name: string;
  meta: string;
  amount: number;
};

export function TxRow({
  icon,
  iconBg,
  name,
  meta,
  amount,
}: TxRowProps): ReactNode {
  return (
    <div className="tx">
      <div className={`ico ${iconBg}`}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className="name">{name}</div>
        <div className="meta">{meta}</div>
      </div>
      <div className={"amt num " + (amount > 0 ? "in" : "")}>
        {(amount > 0 ? "+" : "−") +
          Math.abs(amount).toLocaleString("ru-RU") +
          " ₽"}
      </div>
    </div>
  );
}

function txMeta(transaction: FinanceTransaction): string {
  const date = new Date(transaction.occurred_on);
  const dateLabel = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  return `${categoryLabel(transaction.category)} · ${dateLabel}`;
}

function txIconBg(
  type: FinanceTransaction["type"],
): "red-soft" | "green-soft" | "amber-soft" {
  if (type === "income") return "green-soft";
  if (type === "transfer") return "amber-soft";
  return "red-soft";
}

function txAmount(transaction: FinanceTransaction): number {
  const rub = centsToRub(transaction.amount_cents);
  return transaction.type === "income" ? rub : -rub;
}

export function FinanceScreen(): ReactNode {
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const dashboardQuery = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: getFinanceDashboard,
  });
  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics"],
    queryFn: () => getFinanceAnalytics(),
  });
  const recommendationsQuery = useQuery({
    queryKey: ["finance", "recommendations"],
    queryFn: listFinanceRecommendations,
  });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const recommendations = recommendationsQuery.data ?? [];

  const isLoading = dashboardQuery.isLoading;
  const hasError =
    dashboardQuery.isError &&
    !dashboardQuery.data &&
    !dashboardQuery.isFetching;

  const netWorthRub = centsToRub(dashboard?.net_worth_cents);
  const incomeRub = centsToRub(dashboard?.monthly_income_cents);
  const expenseRub = centsToRub(dashboard?.monthly_expense_cents);
  const remainingRub = centsToRub(dashboard?.remaining_budget_cents);

  const monthlyLimitRub =
    dashboard?.budgets.reduce((sum, b) => sum + centsToRub(b.limit_cents), 0) ??
    0;
  const monthProgressPct =
    monthlyLimitRub > 0
      ? Math.min(100, Math.round((expenseRub / monthlyLimitRub) * 100))
      : 0;

  const topCategories = (analytics?.by_category ?? [])
    .slice(0, 3)
    .map((item) => {
      const budget = dashboard?.budgets.find(
        (b) => b.category === item.category,
      );
      return {
        category: item.category,
        amount: centsToRub(item.expense_cents),
        limit: budget ? centsToRub(budget.limit_cents) : 0,
      };
    });

  const alerts: Array<{
    key: string;
    severity: FinanceAlert["severity"] | FinanceRecommendation["severity"];
    kind: string;
    title: string;
    description: string;
  }> = [
    ...(dashboard?.alerts ?? []).map((a, idx) => ({
      key: `alert-${idx}`,
      severity: a.severity,
      kind: a.kind,
      title: a.message,
      description: a.amount_cents ? fmtCentsRub(a.amount_cents) : "",
    })),
    ...recommendations.slice(0, 3).map((r) => ({
      key: r.id,
      severity: r.severity,
      kind: r.kind,
      title: r.title,
      description: r.suggested_action ?? r.message,
    })),
  ].slice(0, 3);

  return (
    <FinancePhone title="Финансы" activeTab="overview" backTo="/today">
      <div className="red-head tall">
        <div className="row between">
          <div>
            <div className="hello">Финансы</div>
            <Pill>
              <Icon name="calendar" size={10} stroke="white" />{" "}
              {currentMonthLabel()}
            </Pill>
          </div>
          <div className="row gap">
            <button
              type="button"
              className="head-bell"
              aria-label="Уведомления"
            >
              <Icon name="bell" size={16} stroke="white" />
              {alerts.length > 0 ? <span className="dot" /> : null}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.75)", fontSize: 10 }}
          >
            Чистый капитал
          </div>
          {isLoading ? (
            <Skeleton width={220} height={40} style={{ marginTop: 8 }} />
          ) : (
            <h1 className="num">
              {fmt(netWorthRub)}
              <span className="cents"> ₽</span>
            </h1>
          )}
          <div className="sub">
            {isLoading
              ? "Загружаю данные…"
              : `${dashboard?.accounts_count ?? 0} счетов · ${dashboard?.active_goals_count ?? 0} целей`}
          </div>
        </div>
        <div className="kpi-row">
          <div className="kpi">
            <div className="k">Доходы</div>
            <div className="v num">
              {isLoading ? <Skeleton width={60} height={18} /> : fmt(incomeRub)}
            </div>
            <div className="delta up">за месяц</div>
          </div>
          <div className="kpi">
            <div className="k">Расходы</div>
            <div className="v num">
              {isLoading ? (
                <Skeleton width={60} height={18} />
              ) : (
                fmt(expenseRub)
              )}
            </div>
            <div className="delta down">
              {monthlyLimitRub > 0 ? `${monthProgressPct}% лимита` : "за месяц"}
            </div>
          </div>
          <div className="kpi">
            <div className="k">Осталось</div>
            <div className="v num">
              {isLoading ? (
                <Skeleton width={60} height={18} />
              ) : dashboard?.remaining_budget_cents === null ? (
                "—"
              ) : (
                fmt(remainingRub)
              )}
            </div>
            <div className="delta up">
              {dashboard?.remaining_budget_cents === null
                ? "нет бюджета"
                : "до конца месяца"}
            </div>
          </div>
        </div>
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void dashboardQuery.refetch()}
            message="Не удалось загрузить дашборд"
          />
        ) : null}

        <div className="tile-row" style={{ marginTop: -4 }}>
          <Tile
            icon="plus"
            label="Операция"
            tone="red"
            onClick={() => setTxSheetOpen(true)}
          />
          <Tile icon="mic" label="Голосом" tone="red-soft" to="/dump" />
          <Tile
            icon="list"
            label="Все операции"
            tone="red-soft"
            to="/finance/transactions"
          />
          <Tile
            icon="pie"
            label="Аналитика"
            tone="red-soft"
            to="/finance/analytics"
          />
        </div>

        <SectionTitle
          title="Что заметил ассистент"
          action={alerts.length > 0 ? { label: "смотреть все" } : undefined}
        />
        {isLoading ? (
          <Skeleton height={64} />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="Алертов пока нет"
            description="Ассистент подсветит траты вне нормы, подписки и сроки платежей."
          />
        ) : (
          alerts.map((a, idx) => (
            <div key={a.key} style={idx === 0 ? undefined : { marginTop: 10 }}>
              <Alert
                tone={alertTone(a.severity)}
                iconBg={alertIconBg(a.severity)}
                icon={alertIcon(a.kind)}
                iconStroke={alertIconStroke(a.severity)}
                title={a.title}
                description={a.description}
              />
            </div>
          ))
        )}

        <SectionTitle
          title="Куда уходят деньги"
          action={{ label: "подробнее" }}
        />
        <div className="card big">
          <div className="row between">
            <div>
              <div className="label" style={{ fontSize: 10 }}>
                Топ-3 категории
              </div>
              <div
                style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}
                className="num"
              >
                {isLoading ? (
                  <Skeleton width={140} height={24} />
                ) : (
                  fmtCentsRub(dashboard?.monthly_expense_cents)
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tiny mute">осталось</div>
              <div
                className="num"
                style={{ fontWeight: 800, color: "var(--fin-green)" }}
              >
                {isLoading ? (
                  <Skeleton width={100} height={18} />
                ) : dashboard?.remaining_budget_cents === null ? (
                  "—"
                ) : (
                  fmtCentsRub(dashboard?.remaining_budget_cents)
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            {topCategories.length === 0 ? (
              <div className="tiny mute" style={{ paddingTop: 10 }}>
                {isLoading
                  ? "Считаю по категориям…"
                  : "Категории появятся после первых операций."}
              </div>
            ) : (
              topCategories.map((row) => (
                <CatRow
                  key={row.category}
                  icon={categoryIcon(row.category)}
                  name={categoryLabel(row.category)}
                  amount={row.amount}
                  limit={row.limit}
                />
              ))
            )}
          </div>
        </div>

        <SectionTitle title="Последние операции" action={{ label: "все" }} />
        <div className="card">
          {isLoading ? (
            <>
              <div style={{ padding: "10px 0" }}>
                <Skeleton height={36} />
              </div>
              <div style={{ padding: "10px 0" }}>
                <Skeleton height={36} />
              </div>
            </>
          ) : dashboard?.recent_transactions.length ? (
            dashboard.recent_transactions
              .slice(0, 5)
              .map((tx) => (
                <TxRow
                  key={tx.id}
                  icon={categoryIcon(tx.category)}
                  iconBg={txIconBg(tx.type)}
                  name={tx.merchant || categoryLabel(tx.category)}
                  meta={txMeta(tx)}
                  amount={txAmount(tx)}
                />
              ))
          ) : (
            <div className="tiny mute" style={{ padding: "8px 0" }}>
              Операций пока нет — запишите первую голосом или вручную.
            </div>
          )}
        </div>
        <div style={{ height: 16 }} />
      </div>
      <TransactionSheet
        open={txSheetOpen}
        onClose={() => setTxSheetOpen(false)}
      />
    </FinancePhone>
  );
}
