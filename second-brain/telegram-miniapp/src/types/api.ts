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

export type FinanceTransactionType = "expense" | "income" | "transfer";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  type: "cash" | "card" | "checking" | "savings" | "investment" | "loan" | "other";
  currency: string;
  balance_cents: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  account_id?: string | null;
  occurred_on: string;
  type: FinanceTransactionType;
  amount_cents: number;
  currency: string;
  category: string;
  merchant?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceBudget {
  id: string;
  user_id: string;
  category: string;
  period: "monthly" | "weekly";
  limit_cents: number;
  rollover_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount_cents: number;
  saved_amount_cents: number;
  target_date?: string | null;
  linked_account_id?: string | null;
  status: "active" | "paused" | "achieved" | "archived";
  created_at: string;
  updated_at: string;
}

export interface FinanceSubscription {
  id: string;
  user_id: string;
  name: string;
  amount_cents: number;
  currency: string;
  next_charge_date: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceDebt {
  id: string;
  user_id: string;
  name: string;
  type: "credit_card" | "loan" | "mortgage" | "installment" | "personal" | "other";
  balance_cents: number;
  interest_rate_percent?: number | null;
  monthly_payment_cents?: number | null;
  next_payment_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceAsset {
  id: string;
  user_id: string;
  name: string;
  type: "cash" | "brokerage" | "retirement" | "real_estate" | "vehicle" | "other";
  current_value_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceIncome {
  id: string;
  user_id: string;
  source: string;
  amount_cents: number;
  currency: string;
  received_on: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceTaxEvent {
  id: string;
  user_id: string;
  title: string;
  due_date: string;
  amount_cents?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceDocument {
  id: string;
  user_id: string;
  title: string;
  kind: string;
  storage_path?: string | null;
  linked_transaction_id?: string | null;
  extracted_total_cents?: number | null;
  extracted_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceNetWorth {
  accounts_cents: number;
  assets_cents: number;
  debts_cents: number;
  net_worth_cents: number;
}

export interface FinanceNetWorthPoint {
  date: string;
  net_worth_cents: number;
  assets_cents: number;
  debts_cents: number;
}

export interface FinanceNetWorthHistory {
  points: FinanceNetWorthPoint[];
}

export interface FinanceNetWorthProjection {
  current_net_worth_cents: number;
  monthly_cash_flow_cents: number;
  years: number;
  projected_net_worth_cents: number;
  points: FinanceNetWorthPoint[];
}

export interface FinanceAlert {
  kind: string;
  severity: "info" | "warning" | "critical";
  message: string;
  amount_cents?: number;
}

export interface FinanceDashboard {
  currency: string;
  total_balance_cents: number;
  monthly_income_cents: number;
  monthly_expense_cents: number;
  remaining_budget_cents: number | null;
  net_worth_cents: number;
  accounts_count: number;
  active_goals_count: number;
  subscriptions_monthly_cents: number;
  recent_transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  alerts: FinanceAlert[];
}

export interface FinanceAnalytics {
  period_start: string;
  period_end: string;
  income_cents: number;
  expense_cents: number;
  cash_flow_cents: number;
  by_category: Array<{ category: string; expense_cents: number }>;
  daily: Array<{ date: string; expense_cents: number }>;
}

export interface FinanceRecommendation {
  id: string;
  kind: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  message: string;
  suggested_action?: string | null;
  amount_cents?: number | null;
  used_data: string[];
}

export interface FinanceChatResponse {
  answer: string;
  used_data: string[];
  recommendations: FinanceRecommendation[];
  safety_note?: string | null;
}

export interface FinanceSubscriptionDetection {
  merchant: string;
  amount_cents: number;
  currency: string;
  category: string;
  occurrences: number;
  confidence: number;
  suggested_next_charge_date?: string | null;
  transaction_ids: string[];
}

export interface FinanceBudgetTemplate {
  period_months: number;
  items: Array<{
    category: string;
    suggested_limit_cents: number;
    average_monthly_spend_cents: number;
    peak_monthly_spend_cents: number;
    confidence: number;
  }>;
}

export interface FinanceTaxSummary {
  upcoming_events: FinanceTaxEvent[];
  deductible_candidates: Array<{ category: string; amount_cents: number }>;
  documents_count: number;
  safety_note: string;
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
