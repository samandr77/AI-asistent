import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  getFinanceDashboard,
  getFinanceNetWorth,
  listFinanceAssets,
  listFinanceDebts,
  listFinanceGoals,
  listFinanceIncome,
  listFinanceSubscriptions,
  listFinanceTaxEvents,
} from "../../services/api";
import { Icon, type IconName } from "./components/Icon";
import {
  FinancePhone,
  Pill,
  Skeleton,
  centsToRub,
  fmt,
} from "./components/shell";

type Section = {
  to: string;
  icon: IconName;
  iconBg: "red-soft" | "amber-soft" | "blue-soft" | "green-soft";
  title: string;
  subtitle: string | ReactNode;
};

export function MoreScreen(): ReactNode {
  const dashboardQuery = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: getFinanceDashboard,
  });
  const netWorthQuery = useQuery({
    queryKey: ["finance", "net-worth"],
    queryFn: getFinanceNetWorth,
  });
  const goalsQuery = useQuery({
    queryKey: ["finance", "goals"],
    queryFn: listFinanceGoals,
  });
  const assetsQuery = useQuery({
    queryKey: ["finance", "assets"],
    queryFn: listFinanceAssets,
  });
  const debtsQuery = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: listFinanceDebts,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ["finance", "subscriptions"],
    queryFn: listFinanceSubscriptions,
  });
  const taxEventsQuery = useQuery({
    queryKey: ["finance", "tax-events"],
    queryFn: listFinanceTaxEvents,
  });
  const incomeQuery = useQuery({
    queryKey: ["finance", "income"],
    queryFn: listFinanceIncome,
  });

  const dashboard = dashboardQuery.data;
  const netWorth = netWorthQuery.data;
  const goals = goalsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const debts = debtsQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  const taxEvents = taxEventsQuery.data ?? [];
  const income = incomeQuery.data ?? [];

  const activeGoals = goals.filter((g) => g.status === "active");
  const totalSavedRub = activeGoals.reduce(
    (sum, g) => sum + centsToRub(g.saved_amount_cents),
    0,
  );
  const netWorthRub = centsToRub(netWorth?.net_worth_cents);
  const assetsTotal = assets.reduce(
    (sum, a) => sum + centsToRub(a.current_value_cents),
    0,
  );
  const activeSubs = subscriptions.filter((s) => s.is_active);
  const monthlySubs = activeSubs.reduce(
    (sum, s) => sum + centsToRub(s.amount_cents),
    0,
  );
  const debtTotal = debts.reduce(
    (sum, d) => sum + centsToRub(d.balance_cents),
    0,
  );
  const nextTax = [...taxEvents]
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .find((e) => new Date(e.due_date) >= new Date());
  const monthlyIncomeRub = centsToRub(dashboard?.monthly_income_cents);

  const sections: Section[] = [
    {
      to: "/finance/goals",
      icon: "target",
      iconBg: "red-soft",
      title: "Цели",
      subtitle:
        activeGoals.length > 0
          ? `${activeGoals.length} активных · ${fmt(totalSavedRub)} ₽ накоплено`
          : "добавьте первую цель",
    },
    {
      to: "/finance/net-worth",
      icon: "trend-up",
      iconBg: "green-soft",
      title: "Чистый капитал",
      subtitle: netWorth
        ? `${fmt(netWorthRub)} ₽ · активы ${fmt(centsToRub(netWorth.assets_cents))} ₽`
        : "загружаю…",
    },
    {
      to: "/finance/assets",
      icon: "bank",
      iconBg: "blue-soft",
      title: "Активы",
      subtitle:
        assets.length > 0
          ? `${assets.length} активов · ${fmt(assetsTotal)} ₽`
          : "добавьте брокерский счёт или недвижимость",
    },
    {
      to: "/finance/income",
      icon: "briefcase",
      iconBg: "green-soft",
      title: "Доходы",
      subtitle:
        income.length > 0
          ? `${fmt(monthlyIncomeRub)} ₽ за месяц · источников ${
              new Set(income.map((i) => i.source)).size
            }`
          : "учтите первый доход",
    },
    {
      to: "/finance/subscriptions",
      icon: "refresh",
      iconBg: "amber-soft",
      title: "Подписки",
      subtitle:
        activeSubs.length > 0
          ? `${activeSubs.length} активных · ${fmt(monthlySubs)} ₽ / мес`
          : "ассистент найдёт по транзакциям",
    },
    {
      to: "/finance/debts",
      icon: "card",
      iconBg: "red-soft",
      title: "Долги и кредиты",
      subtitle:
        debts.length > 0
          ? `${debts.length} долгов · остаток ${fmt(debtTotal)} ₽`
          : "долгов нет",
    },
    {
      to: "/finance/taxes",
      icon: "doc",
      iconBg: "red-soft",
      title: "Налоги и документы",
      subtitle: nextTax
        ? `${nextTax.title} · до ${new Date(nextTax.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
        : "налоговых событий пока нет",
    },
    {
      to: "/finance/analytics",
      icon: "chart",
      iconBg: "blue-soft",
      title: "Аналитика",
      subtitle: "Расходы, категории, тренды",
    },
  ];

  const isLoading = dashboardQuery.isLoading || netWorthQuery.isLoading;

  return (
    <FinancePhone title="Ещё" activeTab="more" backTo="/finance">
      <div className="red-head">
        <div className="row between">
          <div className="hello">Все разделы</div>
          <Pill>
            {new Date().toLocaleDateString("ru-RU", {
              month: "long",
              year: "numeric",
            })}
          </Pill>
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Чистый капитал
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={240} height={36} />
            ) : (
              fmt(netWorthRub) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading
              ? "Загружаю данные…"
              : dashboard
                ? `${dashboard.accounts_count} счетов · ${activeGoals.length} целей`
                : ""}
          </div>
        </div>
      </div>

      <div className="scroll">
        {sections.map((section) => (
          <Link
            to={section.to}
            key={section.to}
            className="sub-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className={`ico big ${section.iconBg}`}>
              <Icon name={section.icon} size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{section.title}</div>
              <div className="tiny mute">{section.subtitle}</div>
            </div>
            <Icon name="chevron-right" size={16} stroke="var(--fin-mute)" />
          </Link>
        ))}
        <div style={{ height: 16 }} />
      </div>
    </FinancePhone>
  );
}
