import axios from "axios";

import type {
  DumpTextResponse,
  DumpVoiceResponse,
  AccountPendingDeletionResponse,
  AuthMeResponse,
  DailySummary,
  FinanceAccount,
  FinanceAsset,
  FinanceBudget,
  FinanceBudgetTemplate,
  FinanceChatResponse,
  FinanceDashboard,
  FinanceDebt,
  FinanceDocument,
  FinanceGoal,
  FinanceIncome,
  FinanceAnalytics,
  FinanceNetWorth,
  FinanceNetWorthProjection,
  FinanceRecommendation,
  FinanceSubscription,
  FinanceSubscriptionDetection,
  FinanceTaxSummary,
  FinanceTaxEvent,
  FinanceTransaction,
  Goal,
  GoalLevel,
  GoalProgressResponse,
  GoalTreeNode,
  KeyResult,
  KeyResultDirection,
  KeyResultStatus,
  Kpi,
  KpiDirection,
  KpiHistoryEntry,
  MemoryProfileItem,
  Strategy,
  WeeklyReview,
  WeeklyReviewDraft,
  PremiumStatus,
  Reflection,
  ReflectionStats,
  Task,
  TaskCreate,
  TaskProcessAction,
  TaskProcessResponse,
  TelegramInvoiceResponse,
  TelegramReminderSettings,
  UserProfile,
} from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const localPreviewMode = import.meta.env.VITE_LOCAL_PREVIEW_DATA === "1";

let sessionToken: string | null = null;
let onUnauthorized: (() => void | Promise<void>) | null = null;

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

const previewTasks: Task[] = [
  {
    id: "preview-task-1",
    title: "Разобрать утреннюю запись и выбрать три главных дела",
    sphere: "work",
    priority: 1,
    is_done: false,
    is_today: true,
    goal_id: "preview-goal-1",
    notes: "Локальные демо-данные без Supabase.",
    status: "active",
  },
  {
    id: "preview-task-2",
    title: "Проверить Telegram Mini App в боковой панели Codex",
    sphere: "goals",
    priority: 2,
    is_done: false,
    is_today: true,
    status: "active",
  },
  {
    id: "preview-task-3",
    title: "Подготовить вечернюю рефлексию",
    sphere: "health",
    priority: 3,
    is_done: true,
    is_today: true,
    status: "done",
  },
];

const previewGoals: Goal[] = [
  {
    id: "preview-goal-1",
    user_id: "local-preview-user",
    title: "Запустить Второй мозг в Telegram",
    description: "Проверить UI, auth flow, задачи, цели, рефлексию и premium.",
    target_date: today,
    status: "active",
    sphere: "goals",
    progress_percent: 42,
    level: "year",
    parent_goal_id: null,
    horizon_start: null,
    horizon_end: null,
    weight: 1,
    created_at: now,
    updated_at: now,
  },
];

const previewReflection: Reflection = {
  id: "preview-reflection-1",
  user_id: "local-preview-user",
  date: today,
  mood: 7,
  energy: 6,
  notes: "Локальный preview работает без Telegram и Supabase.",
  completed_count: 1,
  goal_aligned_count: 2,
  active_goal_ids: ["preview-goal-1"],
  created_at: now,
  updated_at: now,
};

const previewFinanceTransactions: FinanceTransaction[] = [
  {
    id: "preview-finance-tx-1",
    user_id: "local-preview-user",
    occurred_on: today,
    type: "expense",
    amount_cents: 120000,
    currency: "RUB",
    category: "transport",
    merchant: "Такси",
    note: "Деловая поездка",
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-finance-tx-2",
    user_id: "local-preview-user",
    occurred_on: today,
    type: "income",
    amount_cents: 25000000,
    currency: "RUB",
    category: "salary",
    merchant: "Основная работа",
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-finance-tx-3",
    user_id: "local-preview-user",
    occurred_on: today,
    type: "expense",
    amount_cents: 340000,
    currency: "RUB",
    category: "food",
    merchant: "Продукты",
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceBudgets: FinanceBudget[] = [
  {
    id: "preview-budget-1",
    user_id: "local-preview-user",
    category: "food",
    period: "monthly",
    limit_cents: 6000000,
    rollover_enabled: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-budget-2",
    user_id: "local-preview-user",
    category: "transport",
    period: "monthly",
    limit_cents: 1800000,
    rollover_enabled: false,
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceGoals: FinanceGoal[] = [
  {
    id: "preview-finance-goal-1",
    user_id: "local-preview-user",
    title: "Финансовая подушка",
    target_amount_cents: 30000000,
    saved_amount_cents: 12500000,
    target_date: today,
    status: "active",
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceSubscriptions: FinanceSubscription[] = [
  {
    id: "preview-subscription-1",
    user_id: "local-preview-user",
    name: "ИИ-сервисы",
    amount_cents: 129000,
    currency: "RUB",
    next_charge_date: today,
    category: "subscriptions",
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceDebts: FinanceDebt[] = [
  {
    id: "preview-debt-1",
    user_id: "local-preview-user",
    name: "Кредитная карта",
    type: "credit_card",
    balance_cents: 5200000,
    interest_rate_percent: 19.9,
    monthly_payment_cents: 250000,
    next_payment_date: today,
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceAssets: FinanceAsset[] = [
  {
    id: "preview-asset-1",
    user_id: "local-preview-user",
    name: "Брокерский счёт",
    type: "brokerage",
    current_value_cents: 18500000,
    currency: "RUB",
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceIncome: FinanceIncome[] = [
  {
    id: "preview-income-1",
    user_id: "local-preview-user",
    source: "Основная работа",
    amount_cents: 25000000,
    currency: "RUB",
    received_on: today,
    category: "salary",
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceTaxEvents: FinanceTaxEvent[] = [
  {
    id: "preview-tax-1",
    user_id: "local-preview-user",
    title: "НДФЛ / декларация",
    due_date: today,
    amount_cents: 0,
    notes: "Проверить документы перед отправкой.",
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceDocuments: FinanceDocument[] = [
  {
    id: "preview-document-1",
    user_id: "local-preview-user",
    title: "Чек на технику",
    kind: "receipt",
    extracted_total_cents: 890000,
    extracted_date: today,
    created_at: now,
    updated_at: now,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
});

export function setApiSessionToken(token: string | null): void {
  sessionToken = token;
}

export function registerUnauthorizedHandler(
  handler: () => void | Promise<void>,
): void {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail ?? error.message;

    if (status === 401 && onUnauthorized) {
      await onUnauthorized();
    }

    const appError = new Error(detail);
    (appError as Error & { status?: number }).status = status;
    return Promise.reject(appError);
  },
);

export async function dumpTextRaw(
  text: string,
  userContext: Record<string, unknown> = {},
): Promise<DumpTextResponse> {
  if (localPreviewMode) {
    const task: Task = {
      id: `preview-dump-${Date.now()}`,
      title: text.trim().slice(0, 80) || "Новая задача из записи",
      sphere: "work",
      priority: 2,
      is_done: false,
      is_today: true,
      status: "inbox",
      raw_text: text,
    };
    return {
      dump_id: "preview-dump",
      tasks: [task],
      today_top3: [task, ...clone(previewTasks).slice(0, 2)],
      task_ids: [task.id],
    };
  }
  const { data } = await api.post<DumpTextResponse>("/dump/text", {
    text,
    user_context: userContext,
  });
  return data;
}

export async function dumpVoiceRaw(audio: Blob): Promise<DumpVoiceResponse> {
  const formData = new FormData();
  formData.append("file", audio, "telegram-miniapp-recording.webm");
  const { data } = await api.post<DumpVoiceResponse>("/dump/voice", formData);
  return data;
}

export async function getDumpResult(dumpId: string): Promise<DumpTextResponse> {
  const { data } = await api.get<DumpTextResponse>(`/dump/${dumpId}/result`);
  return data;
}

export async function getTodayTasks(): Promise<Task[]> {
  if (localPreviewMode)
    return clone(previewTasks.filter((task) => task.is_today));
  const { data } = await api.get<Task[]>("/tasks/today");
  return data;
}

export async function getAllTasks(params?: {
  sphere?: string;
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  if (localPreviewMode) return clone(previewTasks);
  const { data } = await api.get<Task[]>("/tasks/", { params });
  return data;
}

export async function updateTask(
  id: string,
  updates: Partial<Task>,
): Promise<Task> {
  if (localPreviewMode) {
    const existing =
      previewTasks.find((task) => task.id === id) ?? previewTasks[0];
    return { ...clone(existing), ...updates };
  }
  const { data } = await api.patch<Task>(`/tasks/${id}`, updates);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function createTask(payload: TaskCreate): Promise<Task> {
  if (localPreviewMode) {
    const created: Task = {
      id: `preview-task-${Date.now()}`,
      title: payload.title,
      sphere: payload.sphere ?? "work",
      priority: payload.priority ?? 2,
      is_done: false,
      is_today: payload.is_today ?? false,
      goal_id: payload.goal_id ?? null,
      notes: payload.notes ?? null,
      status: payload.status ?? "active",
      raw_text: payload.raw_text ?? null,
    };
    previewTasks.unshift(created);
    return clone(created);
  }
  const { data } = await api.post<Task>("/tasks/", payload);
  return data;
}

export async function getInboxTasks(params?: {
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  if (localPreviewMode)
    return clone(previewTasks.filter((t) => t.status === "inbox"));
  const { data } = await api.get<Task[]>("/tasks/inbox", { params });
  return data;
}

export async function processTask(
  id: string,
  action: TaskProcessAction,
): Promise<TaskProcessResponse | null> {
  if (localPreviewMode) {
    const idx = previewTasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const task = previewTasks[idx];
    if (action.action === "delete") {
      previewTasks.splice(idx, 1);
      return null;
    }
    let updated: Task = { ...task };
    if (action.action === "schedule") {
      updated = {
        ...updated,
        status: "active",
        is_today: action.is_today ?? updated.is_today,
        deadline: action.deadline ?? updated.deadline ?? null,
      };
    } else if (action.action === "delegate") {
      updated = { ...updated, status: "delegated" };
    } else if (action.action === "convert_project") {
      updated = { ...updated, status: "active" };
    }
    previewTasks[idx] = updated;
    return { task: clone(updated), already_processed: false };
  }
  const response = await api.post(`/tasks/${id}/process`, action);
  if (response.status === 204) return null;
  return response.data as TaskProcessResponse;
}

export async function listGoals(params?: {
  status?: string;
  sphere?: string;
  level?: GoalLevel;
  parent_goal_id?: string;
  target_date_from?: string;
  target_date_to?: string;
}): Promise<Goal[]> {
  if (localPreviewMode) return clone(previewGoals);
  const { data } = await api.get<Goal[]>("/goals/", { params });
  return data;
}

export async function getGoalTree(): Promise<GoalTreeNode[]> {
  if (localPreviewMode) {
    return previewGoals.map((goal) => ({
      goal: {
        ...clone(goal),
        computed_progress: goal.progress_percent,
        linked_tasks_count: 0,
        completed_tasks_count: 0,
        key_results_count: 0,
        key_results_done_count: 0,
        children_count: 0,
      },
      children: [],
    }));
  }
  const { data } = await api.get<GoalTreeNode[]>("/goals/tree");
  return data;
}

export async function getGoal(id: string): Promise<Goal> {
  if (localPreviewMode) {
    return clone(
      previewGoals.find((goal) => goal.id === id) ?? previewGoals[0],
    );
  }
  const { data } = await api.get<Goal>(`/goals/${id}`);
  return data;
}

export async function createGoal(body: {
  title: string;
  description?: string;
  target_date?: string;
  status?: Goal["status"];
  sphere?: string;
  progress_percent?: number;
  level?: GoalLevel;
  parent_goal_id?: string | null;
  horizon_start?: string;
  horizon_end?: string;
  weight?: number;
}): Promise<Goal> {
  if (localPreviewMode) {
    return {
      id: `preview-goal-${Date.now()}`,
      user_id: "local-preview-user",
      title: body.title,
      description: body.description ?? null,
      target_date: body.target_date ?? null,
      status: body.status ?? "active",
      sphere: (body.sphere as Goal["sphere"]) ?? "goals",
      progress_percent: body.progress_percent ?? 0,
      level: body.level ?? "year",
      parent_goal_id: body.parent_goal_id ?? null,
      horizon_start: body.horizon_start ?? null,
      horizon_end: body.horizon_end ?? null,
      weight: body.weight ?? 1,
      created_at: now,
      updated_at: now,
    };
  }
  const { data } = await api.post<Goal>("/goals/", body);
  return data;
}

export async function updateGoal(
  id: string,
  updates: Partial<Goal>,
): Promise<Goal> {
  if (localPreviewMode) {
    const existing =
      previewGoals.find((goal) => goal.id === id) ?? previewGoals[0];
    return { ...clone(existing), ...updates };
  }
  const { data } = await api.patch<Goal>(`/goals/${id}`, updates);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/goals/${id}`);
}

export async function getGoalTasks(id: string): Promise<Task[]> {
  if (localPreviewMode) {
    return clone(previewTasks.filter((task) => task.goal_id === id));
  }
  const { data } = await api.get<Task[]>(`/goals/${id}/tasks`);
  return data;
}

export async function getGoalProgress(
  id: string,
): Promise<GoalProgressResponse> {
  if (localPreviewMode) {
    return {
      goal_id: id,
      manual_progress: 42,
      computed_progress: 50,
      linked_tasks_count: 2,
      completed_tasks_count: 1,
    };
  }
  const { data } = await api.get<GoalProgressResponse>(`/goals/${id}/progress`);
  return data;
}

export async function getTodaySummary(params?: {
  tzOffset?: number;
  date?: string;
}): Promise<DailySummary> {
  if (localPreviewMode) {
    return {
      date: params?.date ?? today,
      completed_tasks: clone(previewTasks.filter((task) => task.is_done)),
      goal_aligned_tasks: clone(previewTasks.filter((task) => task.goal_id)),
      goals_with_progress: previewGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        sphere: goal.sphere,
        completed_task_count: 1,
      })),
      total_dumps: 3,
      existing_reflection: clone(previewReflection),
    };
  }
  const requestParams: Record<string, string | number> = {};
  if (params?.tzOffset !== undefined) {
    requestParams.tz_offset = params.tzOffset;
  }
  if (params?.date) {
    requestParams.date = params.date;
  }
  const { data } = await api.get<DailySummary>("/reflections/today/summary", {
    params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
  });
  return data;
}

export async function listReflections(params?: {
  limit?: number;
  before?: string;
}): Promise<Reflection[]> {
  if (localPreviewMode) return [clone(previewReflection)];
  const { data } = await api.get<Reflection[]>("/reflections/", { params });
  return data;
}

export async function getReflectionByDate(date: string): Promise<Reflection> {
  if (localPreviewMode) return { ...clone(previewReflection), date };
  const { data } = await api.get<Reflection>(`/reflections/${date}`);
  return data;
}

export async function getReflectionStats(): Promise<ReflectionStats> {
  if (localPreviewMode) {
    return { current_streak: 4, longest_streak: 9, total_reflections: 12 };
  }
  const { data } = await api.get<ReflectionStats>("/reflections/stats");
  return data;
}

export async function createReflection(body: {
  mood: number;
  energy: number;
  notes?: string;
  date?: string;
}): Promise<Reflection> {
  if (localPreviewMode) {
    return {
      ...clone(previewReflection),
      id: `preview-reflection-${Date.now()}`,
      mood: body.mood,
      energy: body.energy,
      notes: body.notes ?? null,
      date: body.date ?? today,
    };
  }
  const { data } = await api.post<Reflection>("/reflections/", body);
  return data;
}

export async function updateReflection(
  id: string,
  updates: Partial<Reflection>,
): Promise<Reflection> {
  if (localPreviewMode) return { ...clone(previewReflection), ...updates };
  const { data } = await api.patch<Reflection>(`/reflections/${id}`, updates);
  return data;
}

export async function deleteReflection(id: string): Promise<void> {
  await api.delete(`/reflections/${id}`);
}

export async function getTelegramReminderSettings(): Promise<TelegramReminderSettings> {
  if (localPreviewMode) {
    return {
      daily_reflection_enabled: true,
      daily_reflection_time: "21:30",
      morning_enabled: true,
      morning_time: "09:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  const { data } = await api.get<TelegramReminderSettings>(
    "/telegram/reminders/settings",
  );
  return data;
}

export async function saveTelegramReminderSettings(
  body: TelegramReminderSettings,
): Promise<TelegramReminderSettings> {
  if (localPreviewMode) return clone(body);
  const { data } = await api.put<TelegramReminderSettings>(
    "/telegram/reminders/settings",
    body,
  );
  return data;
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  if (localPreviewMode) {
    return {
      is_premium: false,
      entitlement_id: null,
      expires_at: null,
      period_type: null,
      store: null,
      cancelled: false,
    };
  }
  const { data } = await api.get<PremiumStatus>("/premium/status");
  return data;
}

export async function createTelegramInvoice(body: {
  plan_id: "premium_monthly";
}): Promise<TelegramInvoiceResponse> {
  const { data } = await api.post<TelegramInvoiceResponse>(
    "/telegram/payments/invoice",
    body,
  );
  return data;
}

export async function refreshTelegramPremium(): Promise<PremiumStatus> {
  const { data } = await api.post<PremiumStatus>("/telegram/payments/refresh");
  return data;
}

export async function getMe(): Promise<AuthMeResponse> {
  if (localPreviewMode) {
    return {
      id: "local-preview-user",
      provider: "telegram",
      profile: {
        id: "local-preview-user",
        name: "Local Tester",
        language: "ru",
        is_onboarded: true,
      },
    };
  }
  const { data } = await api.get<AuthMeResponse>("/auth/me");
  return data;
}

export async function updateProfile(
  body: Partial<UserProfile>,
): Promise<UserProfile> {
  if (localPreviewMode) {
    return {
      id: "local-preview-user",
      name: body.name ?? "Local Tester",
      language: body.language ?? "ru",
      is_onboarded: body.is_onboarded ?? true,
    };
  }
  const { data } = await api.post<UserProfile>("/auth/profile", body);
  return data;
}

export async function deleteAccount(): Promise<AccountPendingDeletionResponse> {
  const { data } =
    await api.delete<AccountPendingDeletionResponse>("/auth/account");
  return data;
}

export async function getMemoryProfile(): Promise<MemoryProfileItem[]> {
  if (localPreviewMode) {
    return [
      {
        id: "preview-memory-1",
        content: "Любит быстрые локальные проверки перед Telegram deploy.",
        metadata: { source: "local-preview" },
        created_at: now,
      },
    ];
  }
  const { data } = await api.get<MemoryProfileItem[]>("/memory/profile");
  return data;
}

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  if (localPreviewMode) {
    const monthlyExpense = previewFinanceTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const monthlyIncome = previewFinanceTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const budgetLimit = previewFinanceBudgets.reduce(
      (sum, budget) => sum + budget.limit_cents,
      0,
    );
    return {
      currency: "RUB",
      total_balance_cents: 43800000,
      monthly_income_cents: monthlyIncome,
      monthly_expense_cents: monthlyExpense,
      remaining_budget_cents: budgetLimit - monthlyExpense,
      net_worth_cents:
        43800000 +
        previewFinanceAssets.reduce(
          (sum, asset) => sum + asset.current_value_cents,
          0,
        ) -
        previewFinanceDebts.reduce((sum, debt) => sum + debt.balance_cents, 0),
      accounts_count: 3,
      active_goals_count: previewFinanceGoals.length,
      subscriptions_monthly_cents: previewFinanceSubscriptions
        .filter((subscription) => subscription.is_active)
        .reduce((sum, subscription) => sum + subscription.amount_cents, 0),
      recent_transactions: clone(previewFinanceTransactions),
      budgets: clone(previewFinanceBudgets),
      alerts: [
        {
          kind: "manual_mode",
          severity: "info",
          message:
            "Банковские интеграции ещё не подключены, доступен ручной учёт.",
        },
      ],
    };
  }
  const { data } = await api.get<FinanceDashboard>("/finance/dashboard");
  return data;
}

export async function listFinanceTransactions(params?: {
  type?: string;
  category?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<FinanceTransaction[]> {
  if (localPreviewMode) return clone(previewFinanceTransactions);
  const { data } = await api.get<FinanceTransaction[]>(
    "/finance/transactions",
    {
      params,
    },
  );
  return data;
}

export async function createFinanceTransaction(body: {
  occurred_on: string;
  type: FinanceTransaction["type"];
  amount_cents: number;
  currency?: string;
  category: string;
  merchant?: string;
  note?: string;
  account_id?: string;
}): Promise<FinanceTransaction> {
  if (localPreviewMode) {
    return {
      id: `preview-finance-tx-${Date.now()}`,
      user_id: "local-preview-user",
      currency: "RUB",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceTransaction>(
    "/finance/transactions",
    body,
  );
  return data;
}

export async function listFinanceBudgets(): Promise<FinanceBudget[]> {
  if (localPreviewMode) return clone(previewFinanceBudgets);
  const { data } = await api.get<FinanceBudget[]>("/finance/budgets");
  return data;
}

export async function createFinanceBudget(body: {
  category: string;
  period?: FinanceBudget["period"];
  limit_cents: number;
  rollover_enabled?: boolean;
}): Promise<FinanceBudget> {
  if (localPreviewMode) {
    return {
      id: `preview-budget-${Date.now()}`,
      user_id: "local-preview-user",
      period: "monthly",
      rollover_enabled: false,
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceBudget>("/finance/budgets", body);
  return data;
}

export async function listFinanceGoals(): Promise<FinanceGoal[]> {
  if (localPreviewMode) return clone(previewFinanceGoals);
  const { data } = await api.get<FinanceGoal[]>("/finance/goals");
  return data;
}

export async function createFinanceGoal(body: {
  title: string;
  target_amount_cents: number;
  saved_amount_cents?: number;
  target_date?: string;
  linked_account_id?: string;
  status?: FinanceGoal["status"];
}): Promise<FinanceGoal> {
  if (localPreviewMode) {
    return {
      id: `preview-finance-goal-${Date.now()}`,
      user_id: "local-preview-user",
      saved_amount_cents: 0,
      status: "active",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceGoal>("/finance/goals", body);
  return data;
}

export async function listFinanceSubscriptions(): Promise<
  FinanceSubscription[]
> {
  if (localPreviewMode) return clone(previewFinanceSubscriptions);
  const { data } = await api.get<FinanceSubscription[]>(
    "/finance/subscriptions",
  );
  return data;
}

export async function createFinanceSubscription(body: {
  name: string;
  amount_cents: number;
  currency?: string;
  next_charge_date: string;
  category?: string;
  is_active?: boolean;
}): Promise<FinanceSubscription> {
  if (localPreviewMode) {
    return {
      id: `preview-subscription-${Date.now()}`,
      user_id: "local-preview-user",
      currency: "RUB",
      category: "subscriptions",
      is_active: true,
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceSubscription>(
    "/finance/subscriptions",
    body,
  );
  return data;
}

export async function getFinanceAnalytics(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<FinanceAnalytics> {
  if (localPreviewMode) {
    const income = previewFinanceTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const expense = previewFinanceTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    return {
      period_start: today,
      period_end: today,
      income_cents: income,
      expense_cents: expense,
      cash_flow_cents: income - expense,
      by_category: [
        { category: "food", expense_cents: 340000 },
        { category: "transport", expense_cents: 120000 },
      ],
      daily: [{ date: today, expense_cents: expense }],
    };
  }
  const { data } = await api.get<FinanceAnalytics>("/finance/analytics", {
    params,
  });
  return data;
}

export async function listFinanceAccounts(): Promise<FinanceAccount[]> {
  if (localPreviewMode) {
    return [
      {
        id: "preview-account-1",
        user_id: "local-preview-user",
        name: "Основная карта",
        type: "card",
        currency: "RUB",
        balance_cents: 43800000,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    ];
  }
  const { data } = await api.get<FinanceAccount[]>("/finance/accounts");
  return data;
}

export async function getFinanceNetWorth(): Promise<FinanceNetWorth> {
  if (localPreviewMode) {
    const accounts = 43800000;
    const assets = previewFinanceAssets.reduce(
      (sum, asset) => sum + asset.current_value_cents,
      0,
    );
    const debts = previewFinanceDebts.reduce(
      (sum, debt) => sum + debt.balance_cents,
      0,
    );
    return {
      accounts_cents: accounts,
      assets_cents: assets,
      debts_cents: debts,
      net_worth_cents: accounts + assets - debts,
    };
  }
  const { data } = await api.get<FinanceNetWorth>("/finance/net-worth");
  return data;
}

export async function getFinanceNetWorthProjection(params?: {
  years?: number;
}): Promise<FinanceNetWorthProjection> {
  if (localPreviewMode) {
    const netWorth = await getFinanceNetWorth();
    const monthlyCashFlow = 850000;
    return {
      current_net_worth_cents: netWorth.net_worth_cents,
      monthly_cash_flow_cents: monthlyCashFlow,
      years: params?.years ?? 5,
      projected_net_worth_cents:
        netWorth.net_worth_cents + monthlyCashFlow * 12 * (params?.years ?? 5),
      points: Array.from({ length: params?.years ?? 5 }, (_, index) => ({
        date: `${new Date().getFullYear() + index + 1}-01-01`,
        net_worth_cents:
          netWorth.net_worth_cents + monthlyCashFlow * 12 * (index + 1),
        assets_cents:
          netWorth.assets_cents + monthlyCashFlow * 12 * (index + 1),
        debts_cents: netWorth.debts_cents,
      })),
    };
  }
  const { data } = await api.get<FinanceNetWorthProjection>(
    "/finance/net-worth/projection",
    {
      params,
    },
  );
  return data;
}

export async function listFinanceRecommendations(): Promise<
  FinanceRecommendation[]
> {
  if (localPreviewMode) {
    return [
      {
        id: "preview-budget",
        kind: "budget",
        severity: "info",
        title: "Еда близко к лимиту",
        message: "Категория еда использовала большую часть месячного бюджета.",
        suggested_action: "Проверить крупные покупки и задать лимит на неделю.",
        amount_cents: 60000,
        used_data: ["finance_budgets", "finance_transactions"],
      },
    ];
  }
  const { data } = await api.get<FinanceRecommendation[]>(
    "/finance/recommendations",
  );
  return data;
}

export async function chatWithFinanceAssistant(body: {
  message: string;
  period_start?: string;
  period_end?: string;
}): Promise<FinanceChatResponse> {
  if (localPreviewMode) {
    return {
      answer:
        "За текущий период больше всего денег ушло на еду и транспорт. Подписки держатся в пределах плана.",
      used_data: ["finance_transactions", "finance_subscriptions"],
      recommendations: await listFinanceRecommendations(),
      safety_note: null,
    };
  }
  const { data } = await api.post<FinanceChatResponse>("/finance/chat", body);
  return data;
}

export async function detectFinanceSubscriptions(): Promise<
  FinanceSubscriptionDetection[]
> {
  if (localPreviewMode) {
    return [
      {
        merchant: "VPN",
        amount_cents: 99000,
        currency: "RUB",
        category: "software",
        occurrences: 3,
        confidence: 0.85,
        suggested_next_charge_date: today,
        transaction_ids: ["preview-finance-tx-2"],
      },
    ];
  }
  const { data } = await api.get<FinanceSubscriptionDetection[]>(
    "/finance/subscriptions/detect",
  );
  return data;
}

export async function getFinanceBudgetTemplate(params?: {
  months?: number;
}): Promise<FinanceBudgetTemplate> {
  if (localPreviewMode) {
    return {
      period_months: params?.months ?? 3,
      items: [
        {
          category: "food",
          suggested_limit_cents: 420000,
          average_monthly_spend_cents: 380000,
          peak_monthly_spend_cents: 460000,
          confidence: 0.75,
        },
      ],
    };
  }
  const { data } = await api.get<FinanceBudgetTemplate>(
    "/finance/budgets/suggest-template",
    {
      params,
    },
  );
  return data;
}

export async function getFinanceTaxSummary(params?: {
  year?: number;
}): Promise<FinanceTaxSummary> {
  if (localPreviewMode) {
    return {
      upcoming_events: clone(previewFinanceTaxEvents),
      deductible_candidates: [{ category: "health", amount_cents: 120000 }],
      documents_count: previewFinanceDocuments.length,
      safety_note:
        "Это предварительная сводка, налоговые решения нужно проверять отдельно.",
    };
  }
  const { data } = await api.get<FinanceTaxSummary>("/finance/taxes/summary", {
    params,
  });
  return data;
}

export async function listFinanceDebts(): Promise<FinanceDebt[]> {
  if (localPreviewMode) return clone(previewFinanceDebts);
  const { data } = await api.get<FinanceDebt[]>("/finance/debts");
  return data;
}

export async function createFinanceDebt(body: {
  name: string;
  type?: FinanceDebt["type"];
  balance_cents: number;
  interest_rate_percent?: number;
  monthly_payment_cents?: number;
  next_payment_date?: string;
}): Promise<FinanceDebt> {
  if (localPreviewMode) {
    return {
      id: `preview-debt-${Date.now()}`,
      user_id: "local-preview-user",
      type: "other",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceDebt>("/finance/debts", body);
  return data;
}

export async function listFinanceAssets(): Promise<FinanceAsset[]> {
  if (localPreviewMode) return clone(previewFinanceAssets);
  const { data } = await api.get<FinanceAsset[]>("/finance/assets");
  return data;
}

export async function createFinanceAsset(body: {
  name: string;
  type?: FinanceAsset["type"];
  current_value_cents: number;
  currency?: string;
}): Promise<FinanceAsset> {
  if (localPreviewMode) {
    return {
      id: `preview-asset-${Date.now()}`,
      user_id: "local-preview-user",
      type: "other",
      currency: "RUB",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceAsset>("/finance/assets", body);
  return data;
}

export async function listFinanceIncome(): Promise<FinanceIncome[]> {
  if (localPreviewMode) return clone(previewFinanceIncome);
  const { data } = await api.get<FinanceIncome[]>("/finance/income");
  return data;
}

export async function createFinanceIncome(body: {
  source: string;
  amount_cents: number;
  currency?: string;
  received_on: string;
  category?: string;
}): Promise<FinanceIncome> {
  if (localPreviewMode) {
    return {
      id: `preview-income-${Date.now()}`,
      user_id: "local-preview-user",
      currency: "RUB",
      category: "income",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceIncome>("/finance/income", body);
  return data;
}

export async function listFinanceTaxEvents(): Promise<FinanceTaxEvent[]> {
  if (localPreviewMode) return clone(previewFinanceTaxEvents);
  const { data } = await api.get<FinanceTaxEvent[]>("/finance/tax-events");
  return data;
}

export async function createFinanceTaxEvent(body: {
  title: string;
  due_date: string;
  amount_cents?: number;
  notes?: string;
}): Promise<FinanceTaxEvent> {
  if (localPreviewMode) {
    return {
      id: `preview-tax-${Date.now()}`,
      user_id: "local-preview-user",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceTaxEvent>("/finance/tax-events", body);
  return data;
}

export async function listFinanceDocuments(): Promise<FinanceDocument[]> {
  if (localPreviewMode) return clone(previewFinanceDocuments);
  const { data } = await api.get<FinanceDocument[]>("/finance/documents");
  return data;
}

export async function createFinanceDocument(body: {
  title: string;
  kind?: string;
  storage_path?: string;
  linked_transaction_id?: string;
  extracted_total_cents?: number;
  extracted_date?: string;
}): Promise<FinanceDocument> {
  if (localPreviewMode) {
    return {
      id: `preview-document-${Date.now()}`,
      user_id: "local-preview-user",
      kind: "receipt",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceDocument>("/finance/documents", body);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Key Results
// ────────────────────────────────────────────────────────────────────────────

export async function listKeyResults(goalId: string): Promise<KeyResult[]> {
  if (localPreviewMode) return [];
  const { data } = await api.get<KeyResult[]>(`/goals/${goalId}/key-results`);
  return data;
}

export async function createKeyResult(
  goalId: string,
  body: {
    title: string;
    metric?: string;
    unit?: string;
    start_value?: number;
    target_value: number;
    current_value?: number;
    direction?: KeyResultDirection;
    status?: KeyResultStatus;
    due_date?: string;
  },
): Promise<KeyResult> {
  if (localPreviewMode) {
    return {
      id: `preview-kr-${Date.now()}`,
      goal_id: goalId,
      user_id: "local-preview-user",
      title: body.title,
      metric: body.metric ?? null,
      unit: body.unit ?? null,
      start_value: body.start_value ?? 0,
      target_value: body.target_value,
      current_value: body.current_value ?? 0,
      direction: body.direction ?? "increase",
      status: body.status ?? "on_track",
      due_date: body.due_date ?? null,
      progress_percent: 0,
      created_at: now,
      updated_at: now,
    };
  }
  const { data } = await api.post<KeyResult>(
    `/goals/${goalId}/key-results`,
    body,
  );
  return data;
}

export async function updateKeyResult(
  goalId: string,
  krId: string,
  updates: Partial<KeyResult>,
): Promise<KeyResult> {
  const { data } = await api.patch<KeyResult>(
    `/goals/${goalId}/key-results/${krId}`,
    updates,
  );
  return data;
}

export async function deleteKeyResult(
  goalId: string,
  krId: string,
): Promise<void> {
  await api.delete(`/goals/${goalId}/key-results/${krId}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Strategy
// ────────────────────────────────────────────────────────────────────────────

export async function getStrategy(): Promise<Strategy> {
  if (localPreviewMode) {
    return {
      user_id: "local-preview-user",
      mission: "Жить осознанно, помогать другим расти",
      vision: null,
      values: ["Семья", "Здоровье", "Творчество"],
      life_areas: ["Работа", "Здоровье", "Финансы", "Отношения", "Развитие"],
      swot_strengths: ["Дисциплина", "Инженерное мышление"],
      swot_weaknesses: ["Прокрастинация"],
      swot_opportunities: ["AI-инструменты"],
      swot_threats: ["Выгорание"],
    };
  }
  const { data } = await api.get<Strategy>("/strategy/");
  return data;
}

export async function updateStrategy(
  body: Partial<Omit<Strategy, "user_id">>,
): Promise<Strategy> {
  const { data } = await api.put<Strategy>("/strategy/", body);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// KPIs
// ────────────────────────────────────────────────────────────────────────────

export async function listKpis(params?: {
  is_active?: boolean;
}): Promise<Kpi[]> {
  if (localPreviewMode) return [];
  const { data } = await api.get<Kpi[]>("/kpis/", { params });
  return data;
}

export async function getKpi(id: string): Promise<Kpi> {
  const { data } = await api.get<Kpi>(`/kpis/${id}`);
  return data;
}

export async function createKpi(body: {
  name: string;
  unit?: string;
  sphere?: string;
  target_value?: number;
  current_value?: number;
  direction?: KpiDirection;
  warning_threshold?: number;
  is_active?: boolean;
}): Promise<Kpi> {
  const { data } = await api.post<Kpi>("/kpis/", body);
  return data;
}

export async function updateKpi(
  id: string,
  updates: Partial<Omit<Kpi, "id" | "history" | "trend_percent" | "status">>,
): Promise<Kpi> {
  const { data } = await api.patch<Kpi>(`/kpis/${id}`, updates);
  return data;
}

export async function deleteKpi(id: string): Promise<void> {
  await api.delete(`/kpis/${id}`);
}

export async function addKpiHistoryEntry(
  kpiId: string,
  body: { value: number; recorded_on?: string; note?: string },
): Promise<KpiHistoryEntry> {
  const { data } = await api.post<KpiHistoryEntry>(
    `/kpis/${kpiId}/history`,
    body,
  );
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Weekly Review
// ────────────────────────────────────────────────────────────────────────────

export async function getWeeklyDraft(
  week?: string,
): Promise<WeeklyReviewDraft> {
  const { data } = await api.get<WeeklyReviewDraft>("/reviews/weekly/draft", {
    params: week ? { week } : undefined,
  });
  return data;
}

export async function listWeeklyReviews(
  limit?: number,
): Promise<WeeklyReview[]> {
  const { data } = await api.get<WeeklyReview[]>("/reviews/weekly", {
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function getWeeklyReview(
  weekStart: string,
): Promise<WeeklyReview> {
  const { data } = await api.get<WeeklyReview>(`/reviews/weekly/${weekStart}`);
  return data;
}

export async function upsertWeeklyReview(body: {
  week_start: string;
  highlights?: string;
  lessons?: string;
  next_week_focus?: string;
  mood?: number;
  energy?: number;
}): Promise<WeeklyReview> {
  const { data } = await api.post<WeeklyReview>("/reviews/weekly", body);
  return data;
}
