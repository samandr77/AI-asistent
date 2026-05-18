import axios from "axios";

import type {
  DumpTextResponse,
  DumpVoiceResponse,
  AccountPendingDeletionResponse,
  AuthMeResponse,
  DailySummary,
  Goal,
  GoalProgressResponse,
  MemoryProfileItem,
  PremiumStatus,
  Reflection,
  ReflectionStats,
  Task,
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
    title: "Разобрать утренний дамп и выбрать top-3",
    sphere: "work",
    priority: 1,
    is_done: false,
    is_today: true,
    goal_id: "preview-goal-1",
    notes: "Локальные демо-данные без Supabase.",
  },
  {
    id: "preview-task-2",
    title: "Проверить Telegram Mini App в боковой панели Codex",
    sphere: "goals",
    priority: 2,
    is_done: false,
    is_today: true,
  },
  {
    id: "preview-task-3",
    title: "Подготовить вечернюю рефлексию",
    sphere: "health",
    priority: 3,
    is_done: true,
    is_today: true,
  },
];

const previewGoals: Goal[] = [
  {
    id: "preview-goal-1",
    user_id: "local-preview-user",
    title: "Запустить Second Brain в Telegram",
    description: "Проверить UI, auth flow, задачи, цели, рефлексию и premium.",
    target_date: today,
    status: "active",
    sphere: "goals",
    progress_percent: 42,
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
      title: text.trim().slice(0, 80) || "Новая задача из дампа",
      sphere: "work",
      priority: 2,
      is_done: false,
      is_today: true,
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
  if (localPreviewMode) return clone(previewTasks.filter((task) => task.is_today));
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
    const existing = previewTasks.find((task) => task.id === id) ?? previewTasks[0];
    return { ...clone(existing), ...updates };
  }
  const { data } = await api.patch<Task>(`/tasks/${id}`, updates);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function listGoals(params?: {
  status?: string;
  sphere?: string;
  target_date_from?: string;
  target_date_to?: string;
}): Promise<Goal[]> {
  if (localPreviewMode) return clone(previewGoals);
  const { data } = await api.get<Goal[]>("/goals/", { params });
  return data;
}

export async function getGoal(id: string): Promise<Goal> {
  if (localPreviewMode) {
    return clone(previewGoals.find((goal) => goal.id === id) ?? previewGoals[0]);
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
    const existing = previewGoals.find((goal) => goal.id === id) ?? previewGoals[0];
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
  const { data } = await api.delete<AccountPendingDeletionResponse>("/auth/account");
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
