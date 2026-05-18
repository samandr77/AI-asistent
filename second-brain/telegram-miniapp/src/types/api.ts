export type Sphere =
  | "work"
  | "family"
  | "study"
  | "health"
  | "finance"
  | "travel"
  | "goals";

export interface Task {
  id: string;
  title: string;
  sphere: Sphere;
  priority: 1 | 2 | 3;
  is_done: boolean;
  is_today: boolean;
  deadline?: string | null;
  reminder_at?: string | null;
  notes?: string | null;
  goal_id?: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: "active" | "paused" | "achieved" | "archived";
  sphere?: Sphere | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressResponse {
  goal_id: string;
  manual_progress: number;
  computed_progress: number | null;
  linked_tasks_count: number;
  completed_tasks_count: number;
}

export interface Reflection {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  energy: number;
  notes: string | null;
  completed_count: number;
  goal_aligned_count: number;
  active_goal_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ReflectionStats {
  current_streak: number;
  longest_streak: number;
  total_reflections: number;
}

export interface TaskBrief {
  id: string;
  title: string;
  goal_id?: string | null;
  sphere?: string | null;
}

export interface GoalBrief {
  id: string;
  title: string;
  sphere?: string | null;
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

export interface TelegramReminderSettings {
  daily_reflection_enabled: boolean;
  daily_reflection_time: string;
  morning_enabled: boolean;
  morning_time: string;
  timezone: string | null;
}

export interface TelegramInvoiceResponse {
  invoice_link: string;
  payload: string;
}

export interface PremiumStatus {
  is_premium: boolean;
  entitlement_id: string | null;
  expires_at: string | null;
  period_type: string | null;
  store: string | null;
  cancelled: boolean;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  language?: string;
  role?: string;
  living_with?: string;
  peak_hours?: string;
  is_onboarded?: boolean;
}

export interface TelegramSessionUser extends UserProfile {
  telegram_user_id: number;
  provider: "telegram";
  username?: string | null;
  photo_url?: string | null;
  deleted_at?: string | null;
}

export interface AuthMeResponse {
  id: string;
  provider: string;
  profile: UserProfile | null;
}

export interface MemoryProfileItem {
  id: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface DumpTextResponse {
  dump_id: string;
  tasks: Task[];
  today_top3: Task[];
  task_ids: string[];
}

export interface DumpVoiceResponse extends DumpTextResponse {
  transcription: string;
}

export interface PendingTextDump {
  id: string;
  kind: "text";
  text: string;
  created_at: number;
  attempts: number;
  last_error?: string;
}

export interface TelegramSessionResponse {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  user: TelegramSessionUser;
  profile: UserProfile | null;
  is_new_user: boolean;
  start_param: string | null;
}

export interface AccountPendingDeletionResponse {
  status?: "scheduled";
  error?: "account_pending_deletion";
  scheduled_for: string;
}
