import { AppState, Platform } from "react-native";
import axios from "axios";
import { createClient, processLock } from "@supabase/supabase-js";
import {
  Task,
  UserProfile,
  Goal,
  Reflection,
  ReflectionStats,
} from "../store/useAppStore";
import { createAsyncStorage } from "./platformStorage";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const authStorage = createAsyncStorage(
  Platform.OS === "web" ? "supabase-auth-web" : "supabase-auth",
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== "web"
      ? { storage: authStorage, lock: processLock, detectSessionInUrl: false }
      : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return Promise.reject(new Error("Not authenticated"));
  }
  config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail ?? error.message;
    const appError = new Error(detail);
    (appError as any).status = status;
    return Promise.reject(appError);
  },
);

export interface DumpTextResponse {
  dump_id: string;
  tasks: Task[];
  today_top3: Task[];
  task_ids: string[];
}

export interface DumpVoiceResponse extends DumpTextResponse {
  transcription: string;
}

export interface MeResponse {
  id: string;
  profile: UserProfile | null;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function upsertProfile(
  profile: Partial<UserProfile>,
): Promise<UserProfile> {
  const { data } = await api.post("/auth/profile", profile);
  return data;
}

export async function dumpText(
  text: string,
  userContext: object = {},
): Promise<DumpTextResponse> {
  const { data } = await api.post("/dump/text", {
    text,
    user_context: userContext,
  });
  return data;
}

export async function dumpVoice(uri: string): Promise<DumpVoiceResponse> {
  const formData = new FormData();
  formData.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
  const { data } = await api.post("/dump/voice", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getTodayTasks(): Promise<Task[]> {
  const { data } = await api.get("/tasks/today");
  return data;
}

export async function getAllTasks(sphere?: string): Promise<Task[]> {
  const { data } = await api.get("/tasks/", {
    params: sphere ? { sphere } : {},
  });
  return data;
}

export async function updateTask(
  id: string,
  updates: Partial<Task>,
): Promise<Task> {
  const { data } = await api.patch(`/tasks/${id}`, updates);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export interface GoalProgressResponse {
  goal_id: string;
  manual_progress: number;
  computed_progress: number | null;
  linked_tasks_count: number;
  completed_tasks_count: number;
}

export async function listGoals(params?: {
  status?: string;
  sphere?: string;
  target_date_from?: string;
  target_date_to?: string;
}): Promise<Goal[]> {
  const { data } = await api.get("/goals/", { params });
  return data;
}

export async function getGoal(id: string): Promise<Goal> {
  const { data } = await api.get(`/goals/${id}`);
  return data;
}

export async function createGoal(body: {
  title: string;
  description?: string;
  target_date?: string;
  status?: string;
  sphere?: string;
  progress_percent?: number;
}): Promise<Goal> {
  const { data } = await api.post("/goals/", body);
  return data;
}

export async function updateGoal(
  id: string,
  body: Partial<{
    title: string;
    description: string;
    target_date: string;
    status: string;
    sphere: string;
    progress_percent: number;
  }>,
): Promise<Goal> {
  const { data } = await api.patch(`/goals/${id}`, body);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/goals/${id}`);
}

export async function linkTaskToGoal(
  goalId: string,
  taskId: string,
): Promise<{ goal_id: string; task_id: string }> {
  const { data } = await api.post(`/goals/${goalId}/tasks/${taskId}`);
  return data;
}

export async function unlinkTaskFromGoal(
  goalId: string,
  taskId: string,
): Promise<{ goal_id: string; task_id: string }> {
  const { data } = await api.delete(`/goals/${goalId}/tasks/${taskId}`);
  return data;
}

export async function getGoalTasks(goalId: string): Promise<Task[]> {
  const { data } = await api.get(`/goals/${goalId}/tasks`);
  return data;
}

export async function getGoalProgress(
  goalId: string,
): Promise<GoalProgressResponse> {
  const { data } = await api.get(`/goals/${goalId}/progress`);
  return data;
}

// ── Reflections ───────────────────────────────────────────────────────────────

export interface TaskBrief {
  id: string;
  title: string;
  goal_id: string | null;
  sphere: string | null;
}

export interface GoalBrief {
  id: string;
  title: string;
  sphere: string | null;
  completed_task_count: number;
}

export interface DailySummary {
  date: string;
  completed_tasks: TaskBrief[];
  goal_aligned_tasks: TaskBrief[];
  goals_with_progress: GoalBrief[];
  total_dumps: number;
  existing_reflection: Reflection | null;
}

export async function getTodaySummary(
  tzOffset?: number,
): Promise<DailySummary> {
  const headers: Record<string, string> = {};
  if (tzOffset !== undefined) {
    headers["X-Timezone-Offset"] = String(tzOffset);
  }
  const { data } = await api.get("/reflections/today/summary", { headers });
  return data;
}

export async function createReflection(body: {
  mood: number;
  energy: number;
  notes?: string;
  date?: string;
}): Promise<Reflection> {
  const { data } = await api.post("/reflections/", body);
  return data;
}

export async function updateReflection(
  id: string,
  body: { mood?: number; energy?: number; notes?: string },
): Promise<Reflection> {
  const { data } = await api.patch(`/reflections/${id}`, body);
  return data;
}

export async function listReflections(params?: {
  limit?: number;
  before?: string;
}): Promise<Reflection[]> {
  const { data } = await api.get("/reflections/", { params });
  return data;
}

export async function getReflectionByDate(date: string): Promise<Reflection> {
  const { data } = await api.get(`/reflections/${date}`);
  return data;
}

export async function getReflectionStats(): Promise<ReflectionStats> {
  const { data } = await api.get("/reflections/stats");
  return data;
}

export async function deleteReflection(id: string): Promise<void> {
  await api.delete(`/reflections/${id}`);
}
