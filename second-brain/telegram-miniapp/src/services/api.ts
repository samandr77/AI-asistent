import axios from "axios";

import type {
  DumpPhotoResponse,
  DumpTextResponse,
  DumpVoiceResponse,
  AccountPendingDeletionResponse,
  AuthMeResponse,
  DailySummary,
  FinanceAccount,
  FinanceAsset,
  FinanceBudget,
  FinanceBudgetEnvelope,
  FinanceBudgetTemplate,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceChatResponse,
  FinanceDashboard,
  FinanceDebt,
  FinanceDocument,
  FinanceGoal,
  FinanceIncome,
  FinanceAnalytics,
  FinanceAnalyzeEntryAction,
  FinanceAnalyzeEntryResponse,
  FinanceForecast,
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
  HealthActivityLog,
  HealthBiomarker,
  HealthDailyLog,
  HealthDashboard,
  HealthFood,
  HealthMealEntry,
  HealthMealType,
  HealthMedicalRecord,
  HealthNutritionDiary,
  HealthNutritionLog,
  HealthNutritionScanResult,
  HealthNutritionTarget,
  HealthNutritionWeeklyReport,
  HealthRecipe,
  HealthSleepGoal,
  HealthSleepLog,
  HealthSleepSession,
  HealthSleepStats,
  HealthWeightLog,
  HealthWorkout,
  Exercise,
  ExerciseFilters,
  Superset,
  SupersetCreate,
  WorkoutSession,
  WorkoutSessionCreate,
  WorkoutSessionUpdate,
  WorkoutSet,
  WorkoutSetCreate,
  WorkoutSetUpdate,
  SportKind,
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
  BigThreeResponse,
  EisenhowerQuadrant,
  FocusSettings,
  FocusSummary,
  HabitStats,
  Task,
  TaskAnalytics,
  TaskCalendar,
  TaskCreate,
  TaskProcessAction,
  TaskProcessResponse,
  TaskProject,
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
    allocated_cents: 6000000,
    rollover_cents: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-budget-2",
    user_id: "local-preview-user",
    category: "transport",
    period: "monthly",
    limit_cents: 1800000,
    rollover_enabled: true,
    allocated_cents: 1800000,
    rollover_cents: 120000,
    created_at: now,
    updated_at: now,
  },
];

const previewFinanceCategories: FinanceCategory[] = [
  {
    id: "preset-food",
    user_id: "local-preview-user",
    name: "Продукты",
    type: "expense",
    icon: "cart",
    color: "#E04F5F",
    is_archived: false,
    is_preset: true,
  },
  {
    id: "preset-cafe",
    user_id: "local-preview-user",
    name: "Кафе и рестораны",
    type: "expense",
    parent_id: "preset-food",
    icon: "coffee",
    color: "#F59E0B",
    is_archived: false,
    is_preset: true,
  },
  {
    id: "preset-transport",
    user_id: "local-preview-user",
    name: "Транспорт",
    type: "expense",
    icon: "car",
    color: "#3B82F6",
    is_archived: false,
    is_preset: true,
  },
  {
    id: "preset-salary",
    user_id: "local-preview-user",
    name: "Зарплата",
    type: "income",
    icon: "wallet",
    color: "#22C55E",
    is_archived: false,
    is_preset: true,
  },
];

const previewFinanceRules: FinanceCategorizationRule[] = [
  {
    id: "preview-rule-taxi",
    user_id: "local-preview-user",
    merchant_pattern: "такси",
    category: "transport",
    priority: 100,
    is_active: true,
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

const previewHealthDailyLogs: HealthDailyLog[] = [
  {
    id: "preview-health-daily-1",
    user_id: "local-preview-user",
    log_date: today,
    mood: 7,
    energy: 6,
    stress: 4,
    readiness_override: null,
    symptoms: [],
    notes: "После прогулки энергия выше, вечером без тяжёлых задач.",
    created_at: now,
    updated_at: now,
  },
];

const previewHealthSleepLogs: HealthSleepLog[] = [
  {
    id: "preview-health-sleep-1",
    user_id: "local-preview-user",
    sleep_date: today,
    bedtime_at: `${today}T23:40:00`,
    wake_at: `${today}T07:20:00`,
    bedtime: "23:40",
    wake_time: "07:20",
    source: "manual",
    time_in_bed_minutes: 480,
    duration_minutes: 460,
    sleep_latency_minutes: 16,
    awakenings_count: 1,
    awake_minutes: 12,
    restoration: 8,
    quality: 8,
    quality_score: 84,
    quality_breakdown: {
      duration: 100,
      routine: 72,
      duration_minutes: 460,
      midpoint_deviation_minutes: 45,
      target_duration_minutes: 480,
    },
    phases: {},
    factors: ["без кофе вечером"],
    notes: "Нормальное восстановление.",
    created_at: now,
    updated_at: now,
  },
];

const previewHealthActivityLogs: HealthActivityLog[] = [
  {
    id: "preview-health-activity-1",
    user_id: "local-preview-user",
    activity_date: today,
    steps: 7400,
    distance_meters: 5200,
    active_minutes: 42,
    calories: 380,
    stand_hours: 8,
    source: "manual",
    created_at: now,
    updated_at: now,
  },
];

const previewHealthWorkouts: HealthWorkout[] = [
  {
    id: "preview-health-workout-1",
    user_id: "local-preview-user",
    occurred_on: today,
    kind: "strength",
    title: "Силовая, верх тела",
    duration_minutes: 45,
    intensity: 7,
    calories: 260,
    muscle_groups: ["спина", "плечи"],
    notes: null,
    created_at: now,
    updated_at: now,
  },
];

const previewHealthNutritionLogs: HealthNutritionLog[] = [
  {
    id: "preview-health-nutrition-1",
    user_id: "local-preview-user",
    logged_on: today,
    calories: 2150,
    protein_g: 118,
    carbs_g: 220,
    fat_g: 72,
    water_ml: 1800,
    notes: "Белок в норме, воды можно добавить.",
    created_at: now,
    updated_at: now,
  },
];

const previewHealthMeals: HealthMealEntry[] = [
  {
    id: "preview-meal-1",
    user_id: "local-preview-user",
    logged_on: today,
    meal_type: "breakfast",
    title: "Завтрак",
    source: "ai",
    confidence: 0.82,
    notes: "Оценено по описанию.",
    created_at: now,
    updated_at: now,
    items: [
      {
        id: "preview-meal-item-1",
        user_id: "local-preview-user",
        meal_id: "preview-meal-1",
        name: "Овсянка с бананом",
        serving_qty: 1,
        serving_name: "тарелка",
        grams: 280,
        calories: 430,
        protein_g: 14,
        carbs_g: 72,
        fat_g: 9,
        fiber_g: 8,
        confidence: 0.8,
        created_at: now,
        updated_at: now,
      },
    ],
  },
  {
    id: "preview-meal-2",
    user_id: "local-preview-user",
    logged_on: today,
    meal_type: "lunch",
    title: "Обед",
    source: "manual",
    confidence: 1,
    notes: null,
    created_at: now,
    updated_at: now,
    items: [
      {
        id: "preview-meal-item-2",
        user_id: "local-preview-user",
        meal_id: "preview-meal-2",
        name: "Курица, рис, салат",
        serving_qty: 1,
        serving_name: "порция",
        grams: 420,
        calories: 720,
        protein_g: 48,
        carbs_g: 82,
        fat_g: 18,
        fiber_g: 7,
        confidence: 0.9,
        created_at: now,
        updated_at: now,
      },
    ],
  },
];

function nutritionSummaryFromMeals(meals: HealthMealEntry[]) {
  return meals.reduce(
    (summary, meal) => {
      for (const item of meal.items) {
        summary.calories += item.calories ?? 0;
        summary.protein_g += item.protein_g ?? 0;
        summary.carbs_g += item.carbs_g ?? 0;
        summary.fat_g += item.fat_g ?? 0;
        summary.fiber_g += item.fiber_g ?? 0;
      }
      return summary;
    },
    {
      logged_on: today,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      water_ml: 1800,
    },
  );
}

const previewHealthBiomarkers: HealthBiomarker[] = [
  {
    id: "preview-health-biomarker-1",
    user_id: "local-preview-user",
    measured_on: today,
    kind: "hrv",
    value: 48,
    unit: "ms",
    source: "manual",
    notes: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "preview-health-biomarker-2",
    user_id: "local-preview-user",
    measured_on: today,
    kind: "resting_heart_rate",
    value: 62,
    unit: "bpm",
    source: "manual",
    notes: null,
    created_at: now,
    updated_at: now,
  },
];

const previewHealthMedicalRecords: HealthMedicalRecord[] = [
  {
    id: "preview-health-medical-1",
    user_id: "local-preview-user",
    record_date: today,
    kind: "lab",
    title: "Общий анализ крови",
    provider: "Лаборатория",
    summary: "Хранить результаты и обсудить с врачом при необходимости.",
    file_url: null,
    is_sensitive: true,
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

export async function dumpPhotoRaw(image: Blob): Promise<DumpPhotoResponse> {
  const formData = new FormData();
  const filename =
    image instanceof File ? image.name : "telegram-miniapp-photo.jpg";
  formData.append("file", image, filename);
  const { data } = await api.post<DumpPhotoResponse>("/dump/photo", formData);
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

export async function searchTasks(params?: {
  status?: string;
  sphere?: string;
  project_id?: string;
  context?: string;
  priority?: number;
  deep_work?: boolean;
  habit_mode?: boolean;
  overdue?: boolean;
  no_date?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  if (localPreviewMode) {
    let rows = clone(previewTasks);
    if (params?.habit_mode !== undefined) {
      rows = rows.filter(
        (task) => Boolean(task.habit_mode) === params.habit_mode,
      );
    }
    if (params?.project_id) {
      rows = rows.filter((task) => task.project_id === params.project_id);
    }
    if (params?.status) {
      rows = rows.filter((task) => task.status === params.status);
    }
    return rows;
  }
  const { data } = await api.get<Task[]>("/tasks/search", { params });
  return data;
}

export async function getTask(id: string): Promise<Task> {
  if (localPreviewMode) {
    return clone(
      previewTasks.find((task) => task.id === id) ?? previewTasks[0],
    );
  }
  const { data } = await api.get<Task>(`/tasks/${id}`);
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

export async function getTaskMatrix(): Promise<
  Record<EisenhowerQuadrant, Task[]>
> {
  if (localPreviewMode) {
    const empty: Record<EisenhowerQuadrant, Task[]> = {
      do_now: [],
      schedule: [],
      delegate: [],
      delete: [],
    };
    for (const task of previewTasks.filter((item) => !item.is_done)) {
      const quadrant =
        task.eisenhower_quadrant ??
        (task.priority === 3 ? "do_now" : "schedule");
      empty[quadrant].push(clone(task));
    }
    return empty;
  }
  const { data } =
    await api.get<Record<EisenhowerQuadrant, Task[]>>("/tasks/matrix");
  return data;
}

export async function getBigThree(
  targetDate: string,
): Promise<BigThreeResponse> {
  if (localPreviewMode) return { date: targetDate, items: [] };
  const { data } = await api.get<BigThreeResponse>("/tasks/big-three", {
    params: { target_date: targetDate },
  });
  return data;
}

export async function setBigThree(
  targetDate: string,
  taskIds: string[],
): Promise<BigThreeResponse> {
  if (localPreviewMode) {
    return {
      date: targetDate,
      items: taskIds.slice(0, 3).map((task_id, index) => ({
        id: `preview-big-three-${index}`,
        task_id,
        position: index + 1,
        date: targetDate,
      })),
    };
  }
  const { data } = await api.post<BigThreeResponse>("/tasks/big-three", {
    date: targetDate,
    task_ids: taskIds.slice(0, 3),
  });
  return data;
}

export async function getTaskCalendar(
  startDate: string,
  days = 7,
): Promise<TaskCalendar> {
  if (localPreviewMode) {
    return {
      start_date: startDate,
      end_date: startDate,
      days: [
        {
          date: startDate,
          tasks: clone(previewTasks.filter((task) => task.scheduled_start)),
          capacity: {
            date: startDate,
            daily_capacity_min: 480,
            scheduled_min: 0,
            estimated_min: 0,
            remaining_min: 480,
            overload: false,
          },
          free_slots: [],
        },
      ],
    };
  }
  const { data } = await api.get<TaskCalendar>("/tasks/calendar", {
    params: { start_date: startDate, days },
  });
  return data;
}

export async function createTimeBlock(payload: {
  task_id: string;
  scheduled_start: string;
  scheduled_end: string;
  deep_work?: boolean;
}): Promise<Task> {
  const { data } = await api.post<Task>("/tasks/time-blocks", payload);
  return data;
}

export async function listTaskProjects(): Promise<TaskProject[]> {
  if (localPreviewMode) return [];
  const { data } = await api.get<TaskProject[]>("/task-projects/");
  return data;
}

export async function createTaskProject(payload: {
  title: string;
  description?: string;
  goal_id?: string;
  deadline?: string;
}): Promise<TaskProject> {
  const { data } = await api.post<TaskProject>("/task-projects/", payload);
  return data;
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
  if (localPreviewMode) {
    return clone(previewTasks.filter((task) => task.project_id === projectId));
  }
  const { data } = await api.get<Task[]>(`/task-projects/${projectId}/tasks`);
  return data;
}

export async function listHabits(): Promise<Task[]> {
  if (localPreviewMode)
    return clone(previewTasks.filter((task) => task.habit_mode));
  const { data } = await api.get<Task[]>("/tasks/habits");
  return data;
}

export async function getHabitStats(taskId: string): Promise<HabitStats> {
  if (localPreviewMode) {
    return {
      task_id: taskId,
      rollover_count: 0,
      completed_count_90d: 0,
      current_streak: 0,
      longest_streak: 0,
      completion_rate_90d: 0,
      focus_sessions: 0,
      focus_minutes: 0,
    };
  }
  const { data } = await api.get<HabitStats>(`/tasks/habits/${taskId}/stats`);
  return data;
}

export async function getFocusSettings(): Promise<FocusSettings> {
  if (localPreviewMode) {
    return {
      pomodoro_min: 25,
      short_break_min: 5,
      long_break_min: 15,
      sessions_before_long_break: 4,
      sound_enabled: true,
      dnd_enabled: false,
    };
  }
  const { data } = await api.get<FocusSettings>("/tasks/focus-settings");
  return data;
}

export async function createFocusSession(
  taskId: string,
  payload: {
    started_at: string;
    ended_at?: string;
    duration_min?: number;
    mode?: string;
    completed?: boolean;
  },
): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `/tasks/${taskId}/focus-sessions`,
    payload,
  );
  return data;
}

export async function getFocusSummary(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<FocusSummary> {
  if (localPreviewMode) {
    return {
      sessions_count: 0,
      completed_count: 0,
      focus_minutes: 0,
      by_mode: {},
      by_day: {},
    };
  }
  const { data } = await api.get<FocusSummary>("/tasks/focus-summary", {
    params,
  });
  return data;
}

export async function getTaskAnalytics(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<TaskAnalytics> {
  if (localPreviewMode) {
    return {
      tasks_total: previewTasks.length,
      completed_count: previewTasks.filter((task) => task.is_done).length,
      goal_aligned_count: previewTasks.filter((task) => task.goal_id).length,
      on_time_rate: null,
      estimate_error_avg_min: null,
      rollover_count: 0,
      focus_minutes: 0,
      completed_by_sphere: {},
    };
  }
  const { data } = await api.get<TaskAnalytics>("/tasks/analytics", { params });
  return data;
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
      cash_flow_cents: monthlyIncome - monthlyExpense,
      top_categories: [
        { category: "food", expense_cents: 340000 },
        { category: "transport", expense_cents: 120000 },
      ],
      upcoming_payments: [
        {
          kind: "subscription",
          title: "ИИ-сервисы",
          amount_cents: 129000,
          due_date: today,
          entity_id: "preview-subscription-1",
        },
      ],
      goals: clone(previewFinanceGoals),
      recent_transactions: clone(previewFinanceTransactions),
      budgets: await listFinanceBudgetEnvelopes(),
      alerts: [
        {
          kind: "manual_mode",
          severity: "info",
          title: "Ручной режим",
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
  account_id?: string;
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
  target_account_id?: string;
  is_recurring?: boolean;
  source?: FinanceTransaction["source"];
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

export async function listFinanceCategories(): Promise<FinanceCategory[]> {
  if (localPreviewMode) return clone(previewFinanceCategories);
  const { data } = await api.get<FinanceCategory[]>("/finance/categories");
  return data;
}

export async function createFinanceCategory(body: {
  name: string;
  type?: FinanceCategory["type"];
  parent_id?: string;
  icon?: string;
  color?: string;
  is_archived?: boolean;
}): Promise<FinanceCategory> {
  if (localPreviewMode) {
    return {
      id: `preview-category-${Date.now()}`,
      user_id: "local-preview-user",
      type: "expense",
      icon: "tag",
      color: "#E04F5F",
      is_archived: false,
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<FinanceCategory>("/finance/categories", body);
  return data;
}

export async function listFinanceCategorizationRules(): Promise<
  FinanceCategorizationRule[]
> {
  if (localPreviewMode) return clone(previewFinanceRules);
  const { data } = await api.get<FinanceCategorizationRule[]>(
    "/finance/categorization-rules",
  );
  return data;
}

export async function listFinanceBudgets(): Promise<FinanceBudget[]> {
  if (localPreviewMode) return clone(previewFinanceBudgets);
  const { data } = await api.get<FinanceBudget[]>("/finance/budgets");
  return data;
}

export async function listFinanceBudgetEnvelopes(): Promise<
  FinanceBudgetEnvelope[]
> {
  if (localPreviewMode) {
    const expense = previewFinanceTransactions.filter(
      (transaction) => transaction.type === "expense",
    );
    return previewFinanceBudgets.map((budget) => {
      const spent = expense
        .filter((transaction) => transaction.category === budget.category)
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
      const allocated =
        (budget.allocated_cents ?? budget.limit_cents) +
        (budget.rollover_enabled ? (budget.rollover_cents ?? 0) : 0);
      const remaining = allocated - spent;
      const usage = allocated ? Math.round((spent / allocated) * 100) : 0;
      return {
        budget_id: budget.id,
        category: budget.category,
        period: budget.period,
        limit_cents: budget.limit_cents,
        allocated_cents: allocated,
        rollover_enabled: budget.rollover_enabled,
        rollover_cents: budget.rollover_cents ?? 0,
        spent_cents: spent,
        remaining_cents: remaining,
        usage_percent: usage,
        status: remaining < 0 ? "over" : usage >= 80 ? "warning" : "ok",
      };
    });
  }
  const { data } = await api.get<FinanceBudgetEnvelope[]>(
    "/finance/budgets/envelopes",
  );
  return data;
}

export async function createFinanceBudget(body: {
  category: string;
  period?: FinanceBudget["period"];
  limit_cents: number;
  rollover_enabled?: boolean;
  allocated_cents?: number;
  rollover_cents?: number;
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

export async function analyzeFinanceEntry(body: {
  text: string;
  occurred_on?: string;
  currency?: string;
}): Promise<FinanceAnalyzeEntryResponse> {
  if (localPreviewMode) {
    const amount = body.text.match(/\d+/)?.[0];
    return {
      source_text: body.text,
      actions: amount
        ? [
            {
              kind: "transaction",
              confidence: 0.86,
              reason: "Нашёл сумму и признаки расхода.",
              needs_confirmation: true,
              payload: {
                occurred_on: body.occurred_on ?? today,
                type: "expense",
                amount_cents: Number(amount) * 100,
                currency: body.currency ?? "RUB",
                category: body.text.toLowerCase().includes("такси")
                  ? "transport"
                  : "other",
                merchant: null,
                note: body.text,
                source: "ai",
              },
            },
          ]
        : [],
    };
  }
  const { data } = await api.post<FinanceAnalyzeEntryResponse>(
    "/finance/analyze-entry",
    body,
  );
  return data;
}

export async function confirmFinanceEntry(
  actions: FinanceAnalyzeEntryAction[],
) {
  if (localPreviewMode) {
    return {
      created: actions.map((action, index) => ({
        kind: action.kind,
        row: {
          id: `preview-confirm-${Date.now()}-${index}`,
          ...action.payload,
        },
      })),
      skipped: [],
    };
  }
  const { data } = await api.post("/finance/analyze-entry/confirm", {
    actions,
  });
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

export async function getFinanceForecast(params?: {
  months?: number;
}): Promise<FinanceForecast> {
  if (localPreviewMode) {
    return {
      period_start: today.slice(0, 8) + "01",
      period_end: today,
      months_used: params?.months ?? 3,
      categories: [
        {
          category: "food",
          average_monthly_spend_cents: 4200000,
          current_spend_cents: 340000,
          predicted_month_end_cents: 4200000,
          budget_limit_cents: 6000000,
          predicted_overrun_cents: 0,
          confidence: 0.81,
        },
        {
          category: "transport",
          average_monthly_spend_cents: 1600000,
          current_spend_cents: 120000,
          predicted_month_end_cents: 1600000,
          budget_limit_cents: 1920000,
          predicted_overrun_cents: 0,
          confidence: 0.76,
        },
      ],
      total_predicted_expense_cents: 5800000,
      total_budget_limit_cents: 7920000,
      total_predicted_overrun_cents: 0,
    };
  }
  const { data } = await api.get<FinanceForecast>("/finance/forecast", {
    params,
  });
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

export async function getHealthDashboard(params?: {
  days?: number;
}): Promise<HealthDashboard> {
  if (localPreviewMode) {
    return {
      score: 72,
      readiness_score: 68,
      trend_days: params?.days ?? 30,
      latest_daily_log: clone(previewHealthDailyLogs[0]),
      latest_sleep: clone(previewHealthSleepLogs[0]),
      latest_activity: clone(previewHealthActivityLogs[0]),
      recent_workouts: clone(previewHealthWorkouts),
      nutrition_today: clone(previewHealthNutritionLogs[0]),
      nutrition_summary: nutritionSummaryFromMeals(previewHealthMeals),
      meals_today: clone(previewHealthMeals),
      biomarkers: [],
      medical_records_count: 0,
      insights: [
        {
          id: "preview-recovery",
          severity: "info",
          title: "День для ровной нагрузки",
          message:
            "Сон, активность и питание держатся в рабочем диапазоне. Это подсказка для планирования, не медицинский вывод.",
          suggested_action:
            "Поставить одну тренировку средней интенсивности и оставить вечер под восстановление.",
          used_data: [
            "health_sleep_logs",
            "health_activity_logs",
            "health_meal_entries",
          ],
        },
      ],
      safety_note:
        "Подсказки по здоровью являются справочной поддержкой и не заменяют врача, диагностику или лечение.",
    };
  }
  const { data } = await api.get<HealthDashboard>("/health/dashboard", {
    params,
  });
  return data;
}

export async function listHealthDailyLogs(): Promise<HealthDailyLog[]> {
  if (localPreviewMode) return clone(previewHealthDailyLogs);
  const { data } = await api.get<HealthDailyLog[]>("/health/daily");
  return data;
}

export async function createHealthDailyLog(body: {
  log_date: string;
  mood?: number;
  energy?: number;
  stress?: number;
  readiness_override?: number;
  symptoms?: string[];
  notes?: string;
}): Promise<HealthDailyLog> {
  if (localPreviewMode) {
    return {
      id: `preview-health-daily-${Date.now()}`,
      user_id: "local-preview-user",
      symptoms: [],
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthDailyLog>("/health/daily", body);
  return data;
}

export async function listHealthSleepLogs(): Promise<HealthSleepLog[]> {
  if (localPreviewMode) return clone(previewHealthSleepLogs);
  const { data } = await api.get<HealthSleepLog[]>("/health/sleep");
  return data;
}

export async function createHealthSleepLog(body: {
  sleep_date: string;
  bedtime_at?: string;
  wake_at?: string;
  bedtime?: string;
  wake_time?: string;
  source?: string;
  time_in_bed_minutes?: number;
  duration_minutes: number;
  sleep_latency_minutes?: number;
  awakenings_count?: number;
  awake_minutes?: number;
  restoration?: number;
  phases?: Record<string, unknown>;
  factors?: string[];
  notes?: string;
}): Promise<HealthSleepLog> {
  if (localPreviewMode) {
    return {
      id: `preview-health-sleep-${Date.now()}`,
      user_id: "local-preview-user",
      phases: {},
      factors: [],
      quality_score: 80,
      quality_breakdown: {
        duration: 90,
        routine: 70,
        duration_minutes: body.duration_minutes,
        midpoint_deviation_minutes: null,
        target_duration_minutes: 480,
      },
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthSleepLog>("/health/sleep", body);
  return data;
}

export async function updateHealthSleepLog(
  id: string,
  body: Partial<{
    sleep_date: string;
    bedtime_at: string;
    wake_at: string;
    bedtime: string;
    wake_time: string;
    source: string;
    duration_minutes: number;
    notes: string;
  }>,
): Promise<HealthSleepLog> {
  if (localPreviewMode) {
    return {
      ...previewHealthSleepLogs[0],
      ...body,
      id,
      updated_at: new Date().toISOString(),
    };
  }
  const { data } = await api.patch<HealthSleepLog>(`/health/sleep/${id}`, body);
  return data;
}

export async function getActiveHealthSleepSession(): Promise<HealthSleepSession | null> {
  if (localPreviewMode) return null;
  const { data } = await api.get<HealthSleepSession | null>(
    "/health/sleep/sessions/active",
  );
  return data;
}

export async function startHealthSleepSession(
  body: {
    started_at?: string;
    source?: string;
  } = {},
): Promise<HealthSleepSession> {
  if (localPreviewMode) {
    return {
      id: `preview-health-sleep-session-${Date.now()}`,
      user_id: "local-preview-user",
      started_at: body.started_at ?? new Date().toISOString(),
      status: "active",
      source: body.source ?? "manual",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const { data } = await api.post<HealthSleepSession>(
    "/health/sleep/sessions/start",
    body,
  );
  return data;
}

export async function wakeHealthSleepSession(
  id: string,
  body: { ended_at?: string; duration_minutes?: number; notes?: string } = {},
): Promise<HealthSleepSession> {
  if (localPreviewMode) {
    return {
      id,
      user_id: "local-preview-user",
      started_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      ended_at: body.ended_at ?? new Date().toISOString(),
      status: "completed",
      source: "manual",
      sleep_log_id: `preview-health-sleep-${Date.now()}`,
      sleep_log: previewHealthSleepLogs[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const { data } = await api.post<HealthSleepSession>(
    `/health/sleep/sessions/${id}/wake`,
    body,
  );
  return data;
}

export async function getHealthSleepGoal(): Promise<HealthSleepGoal> {
  if (localPreviewMode) {
    return {
      user_id: "local-preview-user",
      target_duration_minutes: 480,
      target_bedtime: "23:30",
      target_wake_time: "07:30",
    };
  }
  const { data } = await api.get<HealthSleepGoal>("/health/sleep/goal");
  return data;
}

export async function upsertHealthSleepGoal(
  body: HealthSleepGoal,
): Promise<HealthSleepGoal> {
  if (localPreviewMode) return { ...body, user_id: "local-preview-user" };
  const { data } = await api.put<HealthSleepGoal>("/health/sleep/goal", body);
  return data;
}

export async function getHealthSleepStats(
  params: { days?: number } = {},
): Promise<HealthSleepStats> {
  if (localPreviewMode) {
    return {
      average_duration_minutes: 460,
      average_score: 84,
      average_midpoint_deviation_minutes: 45,
      good_sleep_streak: 3,
      target_duration_minutes: 480,
      nights_count: previewHealthSleepLogs.length,
      series: previewHealthSleepLogs.map((row) => ({
        sleep_date: row.sleep_date,
        duration_minutes: row.duration_minutes,
        quality_score: row.quality_score ?? 0,
        tone: "good",
      })),
      tips: [
        {
          id: "preview-sleep-baseline",
          severity: "info",
          title: "Собираем базу сна",
          message:
            "После нескольких ночей приложение точнее покажет регулярность и тренды.",
          suggested_action: "Записывай время лег/встал в течение недели.",
        },
      ],
    };
  }
  const { data } = await api.get<HealthSleepStats>("/health/sleep/stats", {
    params,
  });
  return data;
}

export async function listHealthActivityLogs(): Promise<HealthActivityLog[]> {
  if (localPreviewMode) return clone(previewHealthActivityLogs);
  const { data } = await api.get<HealthActivityLog[]>("/health/activity");
  return data;
}

export async function createHealthActivityLog(body: {
  activity_date: string;
  steps?: number;
  distance_meters?: number;
  active_minutes?: number;
  calories?: number;
  stand_hours?: number;
  source?: string;
}): Promise<HealthActivityLog> {
  if (localPreviewMode) {
    return {
      id: `preview-health-activity-${Date.now()}`,
      user_id: "local-preview-user",
      steps: 0,
      active_minutes: 0,
      source: "manual",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthActivityLog>("/health/activity", body);
  return data;
}

export async function listHealthWorkouts(): Promise<HealthWorkout[]> {
  if (localPreviewMode) return clone(previewHealthWorkouts);
  const { data } = await api.get<HealthWorkout[]>("/health/workouts");
  return data;
}

export async function createHealthWorkout(body: {
  occurred_on: string;
  kind?: HealthWorkout["kind"];
  title: string;
  duration_minutes?: number;
  intensity?: number;
  calories?: number;
  muscle_groups?: string[];
  notes?: string;
}): Promise<HealthWorkout> {
  if (localPreviewMode) {
    return {
      id: `preview-health-workout-${Date.now()}`,
      user_id: "local-preview-user",
      kind: "other",
      muscle_groups: [],
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthWorkout>("/health/workouts", body);
  return data;
}

export async function listHealthNutritionLogs(): Promise<HealthNutritionLog[]> {
  if (localPreviewMode) return clone(previewHealthNutritionLogs);
  const { data } = await api.get<HealthNutritionLog[]>("/health/nutrition");
  return data;
}

export async function createHealthNutritionLog(body: {
  logged_on: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  water_ml?: number;
  notes?: string;
}): Promise<HealthNutritionLog> {
  if (localPreviewMode) {
    return {
      id: `preview-health-nutrition-${Date.now()}`,
      user_id: "local-preview-user",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthNutritionLog>(
    "/health/nutrition",
    body,
  );
  return data;
}

export async function getHealthNutritionDiary(params?: {
  logged_on?: string;
}): Promise<HealthNutritionDiary> {
  if (localPreviewMode) {
    return {
      logged_on: params?.logged_on ?? today,
      meals: clone(previewHealthMeals),
      water_logs: [
        {
          id: "preview-water-1",
          user_id: "local-preview-user",
          logged_on: today,
          amount_ml: 1800,
          source: "manual",
          created_at: now,
        },
      ],
      summary: nutritionSummaryFromMeals(previewHealthMeals),
    };
  }
  const { data } = await api.get<HealthNutritionDiary>(
    "/health/nutrition/diary",
    { params },
  );
  return data;
}

export async function searchHealthFoods(query: string): Promise<HealthFood[]> {
  if (localPreviewMode) {
    return [
      {
        id: "preview-food-1",
        name: query || "Греческий йогурт",
        brand: "Preview",
        barcode: "4600000000000",
        serving_name: "100 g",
        serving_grams: 100,
        calories_per_100g: 92,
        protein_per_100g: 8,
        carbs_per_100g: 4,
        fat_per_100g: 5,
        fiber_per_100g: 0,
        sugar_per_100g: 4,
        sodium_mg_per_100g: 40,
        source: "local",
        confidence: 0.9,
        is_confirmed: true,
        food_score: "green",
      },
    ];
  }
  const { data } = await api.get<HealthFood[]>("/health/nutrition/foods", {
    params: { query },
  });
  return data;
}

export async function createHealthFood(body: HealthFood): Promise<HealthFood> {
  if (localPreviewMode) return { ...body, id: `preview-food-${Date.now()}` };
  const { data } = await api.post<HealthFood>("/health/nutrition/foods", body);
  return data;
}

export async function lookupHealthFoodBarcode(
  barcode: string,
): Promise<HealthNutritionScanResult> {
  if (localPreviewMode) {
    const candidate = (await searchHealthFoods(barcode))[0];
    return {
      candidate,
      saved_food: candidate,
      needs_confirmation: false,
      source: "preview",
      confidence: 0.9,
    };
  }
  const { data } = await api.post<HealthNutritionScanResult>(
    "/health/nutrition/barcode",
    { barcode },
  );
  return data;
}

export async function scanHealthNutritionPhoto(
  image: Blob,
): Promise<HealthNutritionScanResult> {
  if (localPreviewMode) {
    const candidate = (await searchHealthFoods("Фото упаковки"))[0];
    return {
      candidate,
      saved_food: candidate,
      needs_confirmation: true,
      source: "preview_ai",
      confidence: 0.72,
    };
  }
  const formData = new FormData();
  const filename = image instanceof File ? image.name : "nutrition-package.jpg";
  formData.append("file", image, filename);
  const { data } = await api.post<HealthNutritionScanResult>(
    "/health/nutrition/scan-photo",
    formData,
  );
  return data;
}

export async function getHealthNutritionTarget(): Promise<HealthNutritionTarget> {
  if (localPreviewMode) {
    return {
      calories: 2200,
      protein_g: 120,
      carbs_g: 240,
      fat_g: 75,
      water_ml: 2500,
      goal_type: "maintain",
      diet_mode: "balanced",
    };
  }
  const { data } = await api.get<HealthNutritionTarget>(
    "/health/nutrition/targets",
  );
  return data;
}

export async function upsertHealthNutritionTarget(
  body: HealthNutritionTarget,
): Promise<HealthNutritionTarget> {
  if (localPreviewMode) return { ...body, calories: body.calories ?? 2200 };
  const { data } = await api.post<HealthNutritionTarget>(
    "/health/nutrition/targets",
    body,
  );
  return data;
}

export async function listHealthWeightLogs(): Promise<HealthWeightLog[]> {
  if (localPreviewMode) {
    return [
      {
        id: "preview-weight-1",
        user_id: "local-preview-user",
        logged_on: today,
        weight_kg: 76.4,
        source: "manual",
        created_at: now,
        updated_at: now,
      },
    ];
  }
  const { data } = await api.get<HealthWeightLog[]>("/health/nutrition/weight");
  return data;
}

export async function createHealthWeightLog(body: {
  logged_on: string;
  weight_kg: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  source?: string;
  notes?: string;
}): Promise<HealthWeightLog> {
  if (localPreviewMode) {
    return {
      id: `preview-weight-${Date.now()}`,
      user_id: "local-preview-user",
      source: "manual",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthWeightLog>(
    "/health/nutrition/weight",
    body,
  );
  return data;
}

export async function getHealthNutritionWeeklyReport(): Promise<HealthNutritionWeeklyReport> {
  if (localPreviewMode) {
    return {
      week_start: today,
      week_end: today,
      average_calories: 1910,
      average_protein_g: 104,
      average_water_ml: 2100,
      macro_completion_pct: { calories: 87, protein: 92, water: 84 },
      water_consistency_days: 5,
      weight_trend_kg: -0.3,
      frequent_foods: [{ name: "Йогурт", count: 4, calories: 360 }],
      ai_summary:
        "Питание ровное, белок близко к цели. Это справочная сводка, не медицинская рекомендация.",
      safety_note: "Сводка не заменяет врача или нутрициолога.",
    };
  }
  const { data } = await api.get<HealthNutritionWeeklyReport>(
    "/health/nutrition/report/weekly",
  );
  return data;
}

export async function listHealthRecipes(): Promise<HealthRecipe[]> {
  if (localPreviewMode) return [];
  const { data } = await api.get<HealthRecipe[]>("/health/nutrition/recipes");
  return data;
}

export async function createHealthRecipe(body: {
  title: string;
  servings: number;
  items: Array<{
    name: string;
    serving_qty?: number;
    serving_name?: string;
    grams?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  }>;
  notes?: string;
}): Promise<HealthRecipe> {
  if (localPreviewMode) {
    return {
      id: `preview-recipe-${Date.now()}`,
      user_id: "local-preview-user",
      created_at: now,
      updated_at: now,
      calories_per_serving:
        body.items.reduce((sum, item) => sum + (item.calories ?? 0), 0) /
        body.servings,
      protein_g_per_serving:
        body.items.reduce((sum, item) => sum + (item.protein_g ?? 0), 0) /
        body.servings,
      carbs_g_per_serving:
        body.items.reduce((sum, item) => sum + (item.carbs_g ?? 0), 0) /
        body.servings,
      fat_g_per_serving:
        body.items.reduce((sum, item) => sum + (item.fat_g ?? 0), 0) /
        body.servings,
      ...body,
      items: body.items.map((item, index) => ({
        id: `preview-recipe-item-${index}`,
        user_id: "local-preview-user",
        meal_id: `preview-recipe-${Date.now()}`,
        serving_qty: 1,
        serving_name: "порция",
        created_at: now,
        updated_at: now,
        ...item,
      })),
    };
  }
  const { data } = await api.post<HealthRecipe>(
    "/health/nutrition/recipes",
    body,
  );
  return data;
}

export async function createHealthMeal(body: {
  logged_on: string;
  meal_type: HealthMealType;
  title?: string;
  source?: string;
  confidence?: number;
  notes?: string;
  items: Array<{
    food_id?: string;
    name: string;
    serving_qty?: number;
    serving_name?: string;
    grams?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    confidence?: number;
  }>;
}): Promise<HealthMealEntry> {
  if (localPreviewMode) {
    return {
      id: `preview-meal-${Date.now()}`,
      user_id: "local-preview-user",
      source: "manual",
      confidence: 1,
      notes: null,
      created_at: now,
      updated_at: now,
      ...body,
      items: body.items.map((item, index) => ({
        id: `preview-meal-item-${Date.now()}-${index}`,
        user_id: "local-preview-user",
        meal_id: `preview-meal-${Date.now()}`,
        serving_qty: 1,
        serving_name: "порция",
        created_at: now,
        updated_at: now,
        ...item,
      })),
    };
  }
  const { data } = await api.post<HealthMealEntry>(
    "/health/nutrition/meals",
    body,
  );
  return data;
}

export async function createHealthWaterLog(body: {
  logged_on: string;
  amount_ml: number;
  source?: string;
}) {
  if (localPreviewMode) {
    return {
      id: `preview-water-${Date.now()}`,
      user_id: "local-preview-user",
      source: "manual",
      created_at: now,
      ...body,
    };
  }
  const { data } = await api.post("/health/nutrition/water", body);
  return data;
}

export async function listHealthBiomarkers(): Promise<HealthBiomarker[]> {
  if (localPreviewMode) return clone(previewHealthBiomarkers);
  const { data } = await api.get<HealthBiomarker[]>("/health/biomarkers");
  return data;
}

export async function createHealthBiomarker(body: {
  measured_on: string;
  kind: string;
  value: number;
  unit: string;
  source?: string;
  notes?: string;
}): Promise<HealthBiomarker> {
  if (localPreviewMode) {
    return {
      id: `preview-health-biomarker-${Date.now()}`,
      user_id: "local-preview-user",
      source: "manual",
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthBiomarker>("/health/biomarkers", body);
  return data;
}

export async function listHealthMedicalRecords(): Promise<
  HealthMedicalRecord[]
> {
  if (localPreviewMode) return clone(previewHealthMedicalRecords);
  const { data } = await api.get<HealthMedicalRecord[]>(
    "/health/medical-records",
  );
  return data;
}

export async function createHealthMedicalRecord(body: {
  record_date: string;
  kind?: HealthMedicalRecord["kind"];
  title: string;
  provider?: string;
  summary?: string;
  file_url?: string;
  is_sensitive?: boolean;
}): Promise<HealthMedicalRecord> {
  if (localPreviewMode) {
    return {
      id: `preview-health-medical-${Date.now()}`,
      user_id: "local-preview-user",
      kind: "note",
      is_sensitive: true,
      created_at: now,
      updated_at: now,
      ...body,
    };
  }
  const { data } = await api.post<HealthMedicalRecord>(
    "/health/medical-records",
    body,
  );
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

// ============================================================
// Workouts / Training (feature 009)
// ============================================================

export async function listExercises(
  params?: ExerciseFilters,
): Promise<Exercise[]> {
  const { data } = await api.get<Exercise[]>("/exercises", { params });
  return data;
}

export async function getExercise(slug: string): Promise<Exercise> {
  const { data } = await api.get<Exercise>(`/exercises/${slug}`);
  return data;
}

export async function getPopularExercises(limit = 10): Promise<Exercise[]> {
  const { data } = await api.get<Exercise[]>("/exercises/popular", {
    params: { limit },
  });
  return data;
}

export async function listWorkoutSessions(params?: {
  from?: string;
  to?: string;
  sport_kind?: SportKind;
  is_completed?: boolean;
  goal_id?: string;
  limit?: number;
  offset?: number;
}): Promise<WorkoutSession[]> {
  const { data } = await api.get<WorkoutSession[]>("/workouts/sessions", {
    params,
  });
  return data;
}

export async function getActiveWorkoutSession(): Promise<WorkoutSession | null> {
  const { data } = await api.get<WorkoutSession | null>(
    "/workouts/sessions/active",
  );
  return data;
}

export async function getWorkoutSession(
  sessionId: string,
): Promise<WorkoutSession> {
  const { data } = await api.get<WorkoutSession>(
    `/workouts/sessions/${sessionId}`,
  );
  return data;
}

export async function createWorkoutSession(
  body: WorkoutSessionCreate,
): Promise<WorkoutSession> {
  const { data } = await api.post<WorkoutSession>("/workouts/sessions", body);
  return data;
}

export async function updateWorkoutSession(
  sessionId: string,
  body: WorkoutSessionUpdate,
): Promise<WorkoutSession> {
  const { data } = await api.patch<WorkoutSession>(
    `/workouts/sessions/${sessionId}`,
    body,
  );
  return data;
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  await api.delete(`/workouts/sessions/${sessionId}`);
}

export async function startWorkoutSession(
  sessionId: string,
): Promise<WorkoutSession> {
  const { data } = await api.post<WorkoutSession>(
    `/workouts/sessions/${sessionId}/start`,
  );
  return data;
}

export async function finishWorkoutSession(
  sessionId: string,
): Promise<WorkoutSession> {
  const { data } = await api.post<WorkoutSession>(
    `/workouts/sessions/${sessionId}/finish`,
  );
  return data;
}

export async function listWorkoutSets(
  sessionId: string,
): Promise<WorkoutSet[]> {
  const { data } = await api.get<WorkoutSet[]>(
    `/workouts/sessions/${sessionId}/sets`,
  );
  return data;
}

export async function createWorkoutSet(
  sessionId: string,
  body: WorkoutSetCreate,
): Promise<WorkoutSet> {
  const { data } = await api.post<WorkoutSet>(
    `/workouts/sessions/${sessionId}/sets`,
    body,
  );
  return data;
}

export async function updateWorkoutSet(
  setId: string,
  body: WorkoutSetUpdate,
): Promise<WorkoutSet> {
  const { data } = await api.patch<WorkoutSet>(`/workouts/sets/${setId}`, body);
  return data;
}

export async function deleteWorkoutSet(setId: string): Promise<void> {
  await api.delete(`/workouts/sets/${setId}`);
}

export async function listSupersets(sessionId: string): Promise<Superset[]> {
  const { data } = await api.get<Superset[]>(
    `/workouts/sessions/${sessionId}/supersets`,
  );
  return data;
}

export async function createSuperset(
  sessionId: string,
  body: SupersetCreate,
): Promise<Superset> {
  const { data } = await api.post<Superset>(
    `/workouts/sessions/${sessionId}/supersets`,
    body,
  );
  return data;
}
