import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiAssistantScreen } from "../src/screens/finance/AiAssistantScreen";
import { AnalyticsScreen } from "../src/screens/finance/AnalyticsScreen";
import { AssetsScreen } from "../src/screens/finance/AssetsScreen";
import { BudgetsScreen } from "../src/screens/finance/BudgetsScreen";
import { DebtsScreen } from "../src/screens/finance/DebtsScreen";
import { FinanceScreen } from "../src/screens/finance/FinanceScreen";
import { GoalsScreen } from "../src/screens/finance/GoalsScreen";
import { IncomeScreen } from "../src/screens/finance/IncomeScreen";
import { MoreScreen } from "../src/screens/finance/MoreScreen";
import { NetWorthScreen } from "../src/screens/finance/NetWorthScreen";
import { SubscriptionsScreen } from "../src/screens/finance/SubscriptionsScreen";
import { TaxesScreen } from "../src/screens/finance/TaxesScreen";
import { TransactionsScreen } from "../src/screens/finance/TransactionsScreen";
import {
  detectFinanceSubscriptions,
  getFinanceAnalytics,
  getFinanceBudgetTemplate,
  getFinanceDashboard,
  getFinanceNetWorth,
  getFinanceNetWorthProjection,
  getFinanceTaxSummary,
  listFinanceAccounts,
  listFinanceAssets,
  listFinanceBudgets,
  listFinanceDebts,
  listFinanceDocuments,
  listFinanceGoals,
  listFinanceIncome,
  listFinanceRecommendations,
  listFinanceSubscriptions,
  listFinanceTaxEvents,
  listFinanceTransactions,
} from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    detectFinanceSubscriptions: vi.fn(),
    getFinanceAnalytics: vi.fn(),
    getFinanceBudgetTemplate: vi.fn(),
    getFinanceDashboard: vi.fn(),
    getFinanceNetWorth: vi.fn(),
    getFinanceNetWorthProjection: vi.fn(),
    getFinanceTaxSummary: vi.fn(),
    listFinanceAccounts: vi.fn(),
    listFinanceAssets: vi.fn(),
    listFinanceBudgets: vi.fn(),
    listFinanceDebts: vi.fn(),
    listFinanceDocuments: vi.fn(),
    listFinanceGoals: vi.fn(),
    listFinanceIncome: vi.fn(),
    listFinanceRecommendations: vi.fn(),
    listFinanceSubscriptions: vi.fn(),
    listFinanceTaxEvents: vi.fn(),
    listFinanceTransactions: vi.fn(),
  };
});

const now = "2026-05-20T00:00:00+00:00";

const fixtures = {
  dashboard: {
    currency: "RUB",
    total_balance_cents: 43800000,
    monthly_income_cents: 18240000,
    monthly_expense_cents: 9488000,
    remaining_budget_cents: 3512000,
    net_worth_cents: 284732000,
    accounts_count: 4,
    active_goals_count: 3,
    subscriptions_monthly_cents: 462500,
    alerts: [
      {
        kind: "budget",
        severity: "warning" as const,
        message: "Кафе: превышение лимита",
        amount_cents: 570000,
      },
    ],
    budgets: [
      {
        id: "budget-food",
        user_id: "u1",
        category: "food",
        period: "monthly" as const,
        limit_cents: 4000000,
        rollover_enabled: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: "budget-cafe",
        user_id: "u1",
        category: "cafe",
        period: "monthly" as const,
        limit_cents: 850000,
        rollover_enabled: false,
        created_at: now,
        updated_at: now,
      },
    ],
    recent_transactions: [
      {
        id: "tx-1",
        user_id: "u1",
        occurred_on: "2026-05-20",
        type: "expense" as const,
        amount_cents: 42000,
        currency: "RUB",
        category: "cafe",
        merchant: "Surf Coffee",
        created_at: now,
        updated_at: now,
      },
    ],
  },
  analytics: {
    period_start: "2026-05-01",
    period_end: "2026-05-31",
    income_cents: 18240000,
    expense_cents: 9488000,
    cash_flow_cents: 8752000,
    by_category: [
      { category: "food", expense_cents: 2843000 },
      { category: "cafe", expense_cents: 1420000 },
      { category: "transport", expense_cents: 918000 },
    ],
    daily: [
      { date: "2026-05-19", expense_cents: 408900 },
      { date: "2026-05-20", expense_cents: 694000 },
    ],
  },
  netWorth: {
    accounts_cents: 43800000,
    assets_cents: 432992000,
    debts_cents: 148260000,
    net_worth_cents: 328532000,
  },
  projection: {
    current_net_worth_cents: 328532000,
    monthly_cash_flow_cents: 8752000,
    years: 5,
    projected_net_worth_cents: 890000000,
    points: [
      {
        date: "2027-01-01",
        net_worth_cents: 390000000,
        assets_cents: 500000000,
        debts_cents: 110000000,
      },
      {
        date: "2029-01-01",
        net_worth_cents: 610000000,
        assets_cents: 700000000,
        debts_cents: 90000000,
      },
      {
        date: "2031-01-01",
        net_worth_cents: 890000000,
        assets_cents: 950000000,
        debts_cents: 60000000,
      },
    ],
  },
  goals: [
    {
      id: "goal-1",
      user_id: "u1",
      title: "Отпуск в Тбилиси",
      target_amount_cents: 12000000,
      saved_amount_cents: 9260000,
      target_date: "2026-08-15",
      status: "active" as const,
      created_at: now,
      updated_at: now,
    },
  ],
  assets: [
    {
      id: "asset-1",
      user_id: "u1",
      name: "Брокерский счёт Т-Инвестиции",
      type: "brokerage" as const,
      current_value_cents: 164380000,
      currency: "RUB",
      created_at: now,
      updated_at: now,
    },
  ],
  debts: [
    {
      id: "debt-1",
      user_id: "u1",
      name: "Тинькофф Платинум",
      type: "credit_card" as const,
      balance_cents: 8260000,
      interest_rate_percent: 24.9,
      monthly_payment_cents: 840000,
      next_payment_date: "2026-05-29",
      created_at: now,
      updated_at: now,
    },
  ],
  subscriptions: [
    {
      id: "sub-1",
      user_id: "u1",
      name: "Netflix",
      amount_cents: 99900,
      currency: "RUB",
      next_charge_date: "2026-05-23",
      category: "subscriptions",
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ],
  income: [
    {
      id: "inc-1",
      user_id: "u1",
      source: "Зарплата ООО Декларант",
      amount_cents: 14200000,
      currency: "RUB",
      received_on: "2026-05-18",
      category: "salary",
      created_at: now,
      updated_at: now,
    },
  ],
  taxEvents: (() => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    return [
      {
        id: "tax-1",
        user_id: "u1",
        title: "НПД за май",
        due_date: future.toISOString().slice(0, 10),
        amount_cents: 1428000,
        created_at: now,
        updated_at: now,
      },
    ];
  })(),
  documents: [
    {
      id: "doc-1",
      user_id: "u1",
      title: "Справка 2-НДФЛ",
      kind: "tax",
      extracted_total_cents: null,
      extracted_date: "2026-02-12",
      created_at: now,
      updated_at: now,
    },
  ],
  taxSummary: {
    upcoming_events: [],
    deductible_candidates: [{ category: "health", amount_cents: 3210000 }],
    documents_count: 1,
    safety_note: "Это предварительная сводка.",
  },
  recommendations: [
    {
      id: "rec-1",
      kind: "budget",
      severity: "warning" as const,
      title: "Кафе близко к лимиту",
      message: "Уже 14 200 ₽ из 8 500 ₽ лимита.",
      suggested_action: "Снизить расходы на кафе или поднять бюджет.",
      amount_cents: 570000,
      used_data: ["finance_budgets"],
    },
  ],
  budgetTemplate: {
    period_months: 3,
    items: [
      {
        category: "food",
        suggested_limit_cents: 4200000,
        average_monthly_spend_cents: 3800000,
        peak_monthly_spend_cents: 4600000,
        confidence: 0.75,
      },
    ],
  },
  accounts: [
    {
      id: "acc-1",
      user_id: "u1",
      name: "Тинькофф",
      type: "card" as const,
      currency: "RUB",
      balance_cents: 43800000,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
  ],
  transactions: [
    {
      id: "tx-1",
      user_id: "u1",
      account_id: "acc-1",
      occurred_on: "2026-05-20",
      type: "expense" as const,
      amount_cents: 42000,
      currency: "RUB",
      category: "cafe",
      merchant: "Surf Coffee",
      created_at: now,
      updated_at: now,
    },
    {
      id: "tx-2",
      user_id: "u1",
      account_id: "acc-1",
      occurred_on: "2026-05-19",
      type: "income" as const,
      amount_cents: 14200000,
      currency: "RUB",
      category: "salary",
      merchant: "ООО Декларант",
      created_at: now,
      updated_at: now,
    },
  ],
};

function mockAllApis() {
  vi.mocked(getFinanceDashboard).mockResolvedValue(fixtures.dashboard);
  vi.mocked(getFinanceAnalytics).mockResolvedValue(fixtures.analytics);
  vi.mocked(getFinanceBudgetTemplate).mockResolvedValue(
    fixtures.budgetTemplate,
  );
  vi.mocked(getFinanceNetWorth).mockResolvedValue(fixtures.netWorth);
  vi.mocked(getFinanceNetWorthProjection).mockResolvedValue(
    fixtures.projection,
  );
  vi.mocked(getFinanceTaxSummary).mockResolvedValue(fixtures.taxSummary);
  vi.mocked(listFinanceAccounts).mockResolvedValue(fixtures.accounts);
  vi.mocked(listFinanceAssets).mockResolvedValue(fixtures.assets);
  vi.mocked(listFinanceBudgets).mockResolvedValue(fixtures.dashboard.budgets);
  vi.mocked(listFinanceDebts).mockResolvedValue(fixtures.debts);
  vi.mocked(listFinanceDocuments).mockResolvedValue(fixtures.documents);
  vi.mocked(listFinanceGoals).mockResolvedValue(fixtures.goals);
  vi.mocked(listFinanceIncome).mockResolvedValue(fixtures.income);
  vi.mocked(listFinanceRecommendations).mockResolvedValue(
    fixtures.recommendations,
  );
  vi.mocked(listFinanceSubscriptions).mockResolvedValue(fixtures.subscriptions);
  vi.mocked(listFinanceTaxEvents).mockResolvedValue(fixtures.taxEvents);
  vi.mocked(listFinanceTransactions).mockResolvedValue(fixtures.transactions);
  vi.mocked(detectFinanceSubscriptions).mockResolvedValue([]);
}

function renderScreen(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAllApis();
});

describe("Finance hi-fi screens with API", () => {
  it("Overview pulls dashboard + analytics", async () => {
    renderScreen(<FinanceScreen />);
    expect(await screen.findByText("Куда уходят деньги")).toBeInTheDocument();
    expect(
      await screen.findByText("Кафе: превышение лимита"),
    ).toBeInTheDocument();
    await waitFor(() => expect(getFinanceDashboard).toHaveBeenCalled());
  });

  it("Transactions groups loaded transactions by day", async () => {
    renderScreen(<TransactionsScreen />);
    expect(await screen.findByText("Surf Coffee")).toBeInTheDocument();
    expect(await screen.findByText("ООО Декларант")).toBeInTheDocument();
    await waitFor(() => expect(listFinanceTransactions).toHaveBeenCalled());
  });

  it("Budgets renders progress per category", async () => {
    renderScreen(<BudgetsScreen />);
    expect(await screen.findByText("Продукты")).toBeInTheDocument();
    expect(await screen.findByText("Кафе и рестораны")).toBeInTheDocument();
    expect(await screen.findByText(/Шаблон от ассистента/)).toBeInTheDocument();
  });

  it("Goals shows featured goal", async () => {
    renderScreen(<GoalsScreen />);
    expect(await screen.findByText("Отпуск в Тбилиси")).toBeInTheDocument();
  });

  it("Subscriptions lists subscription items", async () => {
    renderScreen(<SubscriptionsScreen />);
    expect(await screen.findByText("Netflix")).toBeInTheDocument();
  });

  it("Debts renders debt card", async () => {
    renderScreen(<DebtsScreen />);
    expect(await screen.findByText("Тинькофф Платинум")).toBeInTheDocument();
  });

  it("Assets lists assets with allocation", async () => {
    renderScreen(<AssetsScreen />);
    expect(
      await screen.findByText(/Брокерский счёт Т-Инвестиции/),
    ).toBeInTheDocument();
  });

  it("Income shows income sources", async () => {
    renderScreen(<IncomeScreen />);
    expect(
      await screen.findByText(/Зарплата ООО Декларант/),
    ).toBeInTheDocument();
  });

  it("Taxes shows tax events from API", async () => {
    renderScreen(<TaxesScreen />);
    const matches = await screen.findAllByText(/НПД за май/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("NetWorth shows projection", async () => {
    renderScreen(<NetWorthScreen />);
    expect(await screen.findByText("Прогноз ассистента")).toBeInTheDocument();
  });

  it("AI assistant shows quick questions and intro recommendation", async () => {
    renderScreen(<AiAssistantScreen />);
    expect(await screen.findByText("Кафе близко к лимиту")).toBeInTheDocument();
    expect(
      screen.getByText("Какие подписки можно отключить?"),
    ).toBeInTheDocument();
  });

  it("Analytics shows category list", async () => {
    renderScreen(<AnalyticsScreen />);
    expect(await screen.findByText("Топ категорий")).toBeInTheDocument();
  });

  it("More hub renders all section links with counters", async () => {
    renderScreen(<MoreScreen />);
    expect(await screen.findByText("Все разделы")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Цели/ })).toHaveAttribute(
      "href",
      "/finance/goals",
    );
  });
});
