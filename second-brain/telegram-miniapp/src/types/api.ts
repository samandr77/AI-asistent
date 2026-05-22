export type Sphere =
  | "work"
  | "family"
  | "study"
  | "health"
  | "finance"
  | "travel"
  | "goals"
  | "mind"
  | "personal";

export type GoalLevel = "life" | "year" | "quarter" | "week";

export type TaskStatus = "inbox" | "active" | "done" | "archived" | "delegated";

export interface Task {
  id: string;
  title: string;
  sphere: Sphere | null;
  priority: 1 | 2 | 3;
  is_done: boolean;
  is_today: boolean;
  deadline?: string | null;
  reminder_at?: string | null;
  notes?: string | null;
  goal_id?: string | null;
  status: TaskStatus;
  raw_text?: string | null;
  context?: string | null;
  tags?: string[];
  eisenhower_quadrant?: EisenhowerQuadrant | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  duration_estimated_min?: number | null;
  duration_actual_min?: number | null;
  deep_work?: boolean;
  project_id?: string | null;
  parent_task_id?: string | null;
  recurrence_rule?: Record<string, unknown> | null;
  next_occurrence_at?: string | null;
  habit_mode?: boolean;
  rollover_count?: number;
  completed_at?: string | null;
  assignee_name?: string | null;
  assignee_contact?: string | null;
  delegation_status?: string | null;
}

export interface TaskCreate {
  title: string;
  raw_text?: string;
  sphere?: Sphere;
  priority?: 1 | 2 | 3;
  deadline?: string;
  is_today?: boolean;
  status?: TaskStatus;
  goal_id?: string;
  notes?: string;
  reminder_at?: string;
  context?: string;
  tags?: string[];
  eisenhower_quadrant?: EisenhowerQuadrant;
  scheduled_start?: string;
  scheduled_end?: string;
  duration_estimated_min?: number;
  deep_work?: boolean;
  project_id?: string;
  parent_task_id?: string;
  recurrence_rule?: Record<string, unknown>;
  habit_mode?: boolean;
}

export type EisenhowerQuadrant = "do_now" | "schedule" | "delegate" | "delete";

export type TaskProcessAction =
  | {
      action: "schedule";
      is_today?: boolean;
      deadline?: string;
      scheduled_start?: string;
      scheduled_end?: string;
    }
  | { action: "do_now"; is_today?: boolean }
  | { action: "delegate"; delegate_to?: string; delegate_contact?: string }
  | { action: "delete" }
  | { action: "convert_project" }
  | { action: "split_checklist"; checklist_items: string[] };

export interface TaskProcessResponse {
  task: Task;
  already_processed: boolean;
}

export interface TaskProject {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  goal_id?: string | null;
  deadline?: string | null;
  status: "active" | "archived";
  tasks_count?: number;
  done_count?: number;
  progress_percent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export interface BigThreeResponse {
  date: string;
  items: { id: string; task_id: string; position: number; date: string }[];
}

export interface TaskCalendarDay {
  date: string;
  tasks: Task[];
  capacity: {
    date: string;
    daily_capacity_min: number;
    scheduled_min: number;
    estimated_min: number;
    remaining_min: number;
    overload: boolean;
  };
  free_slots: { start: string; end: string }[];
}

export interface TaskCalendar {
  start_date: string;
  end_date: string;
  days: TaskCalendarDay[];
}

export interface TaskAnalytics {
  tasks_total: number;
  completed_count: number;
  goal_aligned_count: number;
  on_time_rate: number | null;
  estimate_error_avg_min: number | null;
  rollover_count: number;
  focus_minutes: number;
  completed_by_sphere: Record<string, number>;
}

export interface FocusSettings {
  pomodoro_min: number;
  short_break_min: number;
  long_break_min: number;
  sessions_before_long_break: number;
  sound_enabled: boolean;
  dnd_enabled: boolean;
}

export interface FocusSummary {
  sessions_count: number;
  completed_count: number;
  focus_minutes: number;
  by_mode: Record<string, number>;
  by_day: Record<string, number>;
}

export interface HabitStats {
  task_id: string;
  rollover_count: number;
  next_occurrence_at?: string | null;
  completed_count_90d: number;
  current_streak: number;
  longest_streak: number;
  completion_rate_90d: number;
  focus_sessions: number;
  focus_minutes: number;
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
  level: GoalLevel;
  parent_goal_id?: string | null;
  horizon_start?: string | null;
  horizon_end?: string | null;
  weight: number;
  created_at: string;
  updated_at: string;
}

export type KeyResultDirection = "increase" | "decrease" | "maintain";
export type KeyResultStatus = "on_track" | "at_risk" | "off_track" | "done";

export interface KeyResult {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  metric?: string | null;
  unit?: string | null;
  start_value: number;
  target_value: number;
  current_value: number;
  direction: KeyResultDirection;
  status: KeyResultStatus;
  due_date?: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface GoalTreeNode {
  goal: Goal & {
    computed_progress?: number;
    linked_tasks_count?: number;
    completed_tasks_count?: number;
    key_results_count?: number;
    key_results_done_count?: number;
    children_count?: number;
  };
  children: GoalTreeNode[];
}

export interface Strategy {
  user_id: string;
  mission: string | null;
  vision: string | null;
  values: string[];
  life_areas: string[];
  swot_strengths: string[];
  swot_weaknesses: string[];
  swot_opportunities: string[];
  swot_threats: string[];
}

export type KpiDirection = "increase" | "decrease" | "maintain";
export type KpiStatus = "ok" | "warning" | "breach";

export interface KpiHistoryEntry {
  id: string;
  kpi_id: string;
  user_id: string;
  recorded_on: string;
  value: number;
  note?: string | null;
  created_at: string;
}

export interface Kpi {
  id: string;
  user_id: string;
  name: string;
  unit?: string | null;
  sphere?: Sphere | null;
  target_value: number | null;
  current_value: number | null;
  direction: KpiDirection;
  warning_threshold: number | null;
  is_active: boolean;
  history: KpiHistoryEntry[];
  trend_percent: number | null;
  status: KpiStatus;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  highlights: string | null;
  lessons: string | null;
  next_week_focus: string | null;
  okr_progress: { items?: WeeklyReviewOkrItem[] };
  completed_tasks_count: number;
  carried_over_count: number;
  mood: number | null;
  energy: number | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReviewOkrItem {
  goal_id: string;
  title: string;
  level: GoalLevel;
  computed_progress: number;
  key_results_done: number;
  key_results_total: number;
}

export interface WeeklyReviewDraft {
  week_start: string;
  week_end: string;
  completed_tasks_count: number;
  carried_over_count: number;
  active_goals: number;
  okr_progress: WeeklyReviewOkrItem[];
  top_completed: { id: string; title: string; sphere: string | null }[];
  suggestions: string[];
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
  health_events?: ParsedHealthEvent[];
  saved_health_events?: SavedHealthEvent[];
  pending_health_events?: ParsedHealthEvent[];
}

export interface DumpVoiceResponse extends DumpTextResponse {
  transcription: string;
}

export interface DumpPhotoResponse extends DumpTextResponse {
  extracted_text: string;
}

export interface ParsedHealthEvent {
  type:
    | "sleep_log"
    | "activity_log"
    | "workout"
    | "nutrition_meal"
    | "water_log";
  event_date?: string | null;
  source_text: string;
  confidence: number;
  data: Record<string, unknown>;
}

export interface SavedHealthEvent {
  type: ParsedHealthEvent["type"];
  row: Record<string, unknown>;
  confidence: number;
}

export type FinanceTransactionType = "expense" | "income" | "transfer";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  type:
    | "cash"
    | "card"
    | "checking"
    | "savings"
    | "investment"
    | "loan"
    | "other";
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
  target_account_id?: string | null;
  occurred_on: string;
  type: FinanceTransactionType;
  amount_cents: number;
  currency: string;
  category: string;
  merchant?: string | null;
  note?: string | null;
  is_recurring?: boolean;
  source?: "manual" | "ai" | "csv" | "receipt" | "bank" | "telegram" | string;
  import_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  type: FinanceTransactionType;
  parent_id?: string | null;
  icon: string;
  color: string;
  is_archived: boolean;
  is_preset?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceCategorizationRule {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category: string;
  category_id?: string | null;
  priority: number;
  is_active: boolean;
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
  allocated_cents?: number | null;
  rollover_cents?: number;
  created_at: string;
  updated_at: string;
}

export interface FinanceBudgetEnvelope {
  budget_id: string;
  category: string;
  period: FinanceBudget["period"];
  limit_cents: number;
  allocated_cents: number;
  rollover_enabled: boolean;
  rollover_cents: number;
  spent_cents: number;
  remaining_cents: number;
  usage_percent: number;
  status: "ok" | "warning" | "over" | string;
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
  type:
    | "credit_card"
    | "loan"
    | "mortgage"
    | "installment"
    | "personal"
    | "other";
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
  type:
    | "cash"
    | "brokerage"
    | "retirement"
    | "real_estate"
    | "vehicle"
    | "other";
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
  title?: string;
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
  cash_flow_cents?: number;
  top_categories?: Array<{ category: string; expense_cents: number }>;
  upcoming_payments?: Array<{
    kind: "subscription" | "debt" | string;
    title: string;
    amount_cents: number;
    due_date: string;
    entity_id?: string | null;
  }>;
  goals?: FinanceGoal[];
  recent_transactions: FinanceTransaction[];
  budgets: Array<FinanceBudget | FinanceBudgetEnvelope>;
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

export interface FinanceAnalyzeEntryAction {
  kind:
    | "transaction"
    | "income"
    | "subscription"
    | "budget_update"
    | "goal"
    | "debt"
    | "asset"
    | "tax_event"
    | "document"
    | "note"
    | "question"
    | string;
  confidence: number;
  payload: Record<string, unknown>;
  reason: string;
  needs_confirmation: boolean;
}

export interface FinanceAnalyzeEntryResponse {
  source_text: string;
  actions: FinanceAnalyzeEntryAction[];
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

export interface FinanceForecast {
  period_start: string;
  period_end: string;
  months_used: number;
  categories: Array<{
    category: string;
    average_monthly_spend_cents: number;
    current_spend_cents: number;
    predicted_month_end_cents: number;
    budget_limit_cents?: number | null;
    predicted_overrun_cents: number;
    confidence: number;
  }>;
  total_predicted_expense_cents: number;
  total_budget_limit_cents: number;
  total_predicted_overrun_cents: number;
}

export interface FinanceTaxSummary {
  upcoming_events: FinanceTaxEvent[];
  deductible_candidates: Array<{ category: string; amount_cents: number }>;
  documents_count: number;
  safety_note: string;
}

export interface HealthDailyLog {
  id: string;
  user_id: string;
  log_date: string;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  readiness_override?: number | null;
  symptoms: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthSleepLog {
  id: string;
  user_id: string;
  sleep_date: string;
  bedtime_at?: string | null;
  wake_at?: string | null;
  bedtime?: string | null;
  wake_time?: string | null;
  source?: string | null;
  time_in_bed_minutes?: number | null;
  duration_minutes: number;
  sleep_latency_minutes?: number | null;
  awakenings_count?: number | null;
  awake_minutes?: number | null;
  restoration?: number | null;
  quality?: number | null;
  quality_score?: number | null;
  quality_breakdown?: Record<string, number | null> | null;
  phases: Record<string, unknown>;
  factors: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthSleepSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string | null;
  status: "active" | "completed" | "cancelled";
  source: string;
  sleep_log_id?: string | null;
  sleep_log?: HealthSleepLog;
  created_at: string;
  updated_at: string;
}

export interface HealthSleepGoal {
  user_id?: string;
  target_duration_minutes: number;
  target_bedtime?: string | null;
  target_wake_time?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HealthSleepStats {
  average_duration_minutes: number;
  average_score: number;
  average_midpoint_deviation_minutes?: number | null;
  good_sleep_streak: number;
  target_duration_minutes: number;
  nights_count: number;
  series: Array<{
    sleep_date: string;
    duration_minutes: number;
    quality_score: number;
    tone: "good" | "warn" | "low" | "unknown" | string;
  }>;
  tips: Array<{
    id: string;
    severity: "info" | "warning" | "critical" | string;
    title: string;
    message: string;
    suggested_action?: string | null;
  }>;
}

export interface HealthActivityLog {
  id: string;
  user_id: string;
  activity_date: string;
  steps: number;
  distance_meters?: number | null;
  active_minutes: number;
  calories?: number | null;
  stand_hours?: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface HealthWorkout {
  id: string;
  user_id: string;
  occurred_on: string;
  kind:
    | "strength"
    | "cardio"
    | "yoga"
    | "stretching"
    | "walk"
    | "sport"
    | "other";
  title: string;
  duration_minutes?: number | null;
  intensity?: number | null;
  calories?: number | null;
  muscle_groups: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthNutritionLog {
  id: string;
  user_id: string;
  logged_on: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  water_ml?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type HealthMealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface HealthMealItem {
  id: string;
  user_id: string;
  meal_id: string;
  food_id?: string | null;
  name: string;
  serving_qty: number;
  serving_name: string;
  grams?: number | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  confidence?: number | null;
  created_at: string;
  updated_at: string;
}

export interface HealthMealEntry {
  id: string;
  user_id: string;
  logged_on: string;
  meal_type: HealthMealType;
  title?: string | null;
  source: string;
  confidence?: number | null;
  notes?: string | null;
  items: HealthMealItem[];
  created_at: string;
  updated_at: string;
}

export interface HealthWaterLog {
  id: string;
  user_id: string;
  logged_on: string;
  amount_ml: number;
  source: string;
  created_at: string;
}

export interface HealthNutritionSummary {
  logged_on: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  target?: HealthNutritionTarget | null;
  remaining_calories?: number | null;
}

export interface HealthNutritionDiary {
  logged_on: string;
  meals: HealthMealEntry[];
  water_logs: HealthWaterLog[];
  summary: HealthNutritionSummary;
}

export interface HealthFood {
  id?: string;
  user_id?: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  serving_name: string;
  serving_grams: number;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  sodium_mg_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  micronutrients?: Record<string, unknown>;
  source: string;
  source_ref?: string | null;
  confidence?: number | null;
  is_confirmed?: boolean;
  food_score?: "green" | "yellow" | "red" | null;
  image_text?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HealthNutritionScanResult {
  candidate: HealthFood;
  saved_food?: HealthFood | null;
  needs_confirmation: boolean;
  source: string;
  confidence?: number | null;
}

export interface HealthNutritionTarget {
  user_id?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  water_ml?: number | null;
  sex?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  goal_weight_kg?: number | null;
  activity_level?:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "very_active";
  goal_type?: "lose" | "maintain" | "gain";
  diet_mode?: "balanced" | "high_protein" | "keto" | "mediterranean" | "vegan";
  bmr?: number | null;
  tdee?: number | null;
}

export interface HealthWeightLog {
  id: string;
  user_id: string;
  logged_on: string;
  weight_kg: number;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  source: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthRecipe {
  id: string;
  user_id: string;
  title: string;
  servings: number;
  items: HealthMealItem[];
  calories_per_serving?: number | null;
  protein_g_per_serving?: number | null;
  carbs_g_per_serving?: number | null;
  fat_g_per_serving?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthNutritionWeeklyReport {
  week_start: string;
  week_end: string;
  average_calories: number;
  average_protein_g: number;
  average_water_ml: number;
  macro_completion_pct: Record<string, number>;
  water_consistency_days: number;
  weight_trend_kg?: number | null;
  frequent_foods: Array<{ name: string; count: number; calories: number }>;
  ai_summary: string;
  safety_note: string;
}

export interface HealthBiomarker {
  id: string;
  user_id: string;
  measured_on: string;
  kind: string;
  value: number;
  unit: string;
  source: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthMedicalRecord {
  id: string;
  user_id: string;
  record_date: string;
  kind: "lab" | "medication" | "visit" | "vaccine" | "document" | "note";
  title: string;
  provider?: string | null;
  summary?: string | null;
  file_url?: string | null;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthInsight {
  id: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  message: string;
  suggested_action?: string | null;
  used_data: string[];
}

export interface HealthDashboard {
  score: number;
  readiness_score: number;
  trend_days: number;
  latest_daily_log?: HealthDailyLog | null;
  latest_sleep?: HealthSleepLog | null;
  latest_activity?: HealthActivityLog | null;
  recent_workouts: HealthWorkout[];
  nutrition_today?: HealthNutritionLog | null;
  nutrition_summary?: HealthNutritionSummary | null;
  meals_today: HealthMealEntry[];
  biomarkers: HealthBiomarker[];
  medical_records_count: number;
  insights: HealthInsight[];
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

// ============================================================
// Workouts / Training (feature 009)
// ============================================================

export type SportKind =
  | "running"
  | "cycling"
  | "mtb"
  | "gravel"
  | "walking"
  | "hiking"
  | "swim_pool"
  | "swim_open_water"
  | "ski"
  | "snowboard"
  | "climb"
  | "mountaineering"
  | "row"
  | "kayak"
  | "sup"
  | "golf"
  | "yoga"
  | "pilates"
  | "hiit"
  | "dance"
  | "other";

export type WorkoutSessionType =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "hiit"
  | "cardio"
  | "mobility"
  | "sport";

export type PrimaryMuscle =
  | "chest"
  | "back"
  | "lats"
  | "traps"
  | "delts_front"
  | "delts_side"
  | "delts_rear"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "obliques"
  | "lower_back"
  | "neck"
  | "full_body";

export type ExerciseCategory =
  | "strength"
  | "cardio"
  | "stretching"
  | "plyometric"
  | "mobility";

export interface Exercise {
  id: string;
  user_id: string | null;
  slug: string;
  name_ru: string;
  name_en?: string | null;
  primary_muscle: PrimaryMuscle;
  secondary_muscles: string[];
  equipment: string[];
  category: ExerciseCategory;
  is_compound: boolean;
  is_unilateral: boolean;
  default_rest_seconds?: number | null;
  tempo_default?: string | null;
  instructions?: string | null;
  gif_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
  sport_kind?: SportKind | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ExerciseFilters {
  muscle?: string;
  equipment?: string;
  category?: ExerciseCategory;
  sport_kind?: SportKind;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface WorkoutSet {
  id: string;
  user_id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps?: number | null;
  weight_kg?: number | null;
  weight_unit: "kg" | "lb";
  rir?: number | null;
  rpe?: number | null;
  tempo?: string | null;
  is_warmup: boolean;
  is_dropset: boolean;
  dropset_group?: number | null;
  superset_id?: string | null;
  rest_seconds_actual?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface WorkoutSetCreate {
  exercise_id: string;
  set_number?: number;
  reps?: number | null;
  weight_kg?: number | null;
  weight_unit?: "kg" | "lb";
  rir?: number | null;
  rpe?: number | null;
  tempo?: string | null;
  is_warmup?: boolean;
  is_dropset?: boolean;
  dropset_group?: number | null;
  superset_id?: string | null;
  rest_seconds_actual?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  notes?: string | null;
}

export interface WorkoutSetUpdate {
  set_number?: number;
  reps?: number | null;
  weight_kg?: number | null;
  rir?: number | null;
  rpe?: number | null;
  tempo?: string | null;
  is_warmup?: boolean;
  is_dropset?: boolean;
  rest_seconds_actual?: number | null;
  duration_seconds?: number | null;
  notes?: string | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  session_type: WorkoutSessionType;
  sport_kind?: SportKind | null;
  title: string;
  location?: string | null;
  occurred_on: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
  rpe?: number | null;
  mood_before?: number | null;
  mood_after?: number | null;
  energy_before?: number | null;
  energy_after?: number | null;
  training_load_score?: number | null;
  intensity_minutes?: number | null;
  calories?: number | null;
  program_session_id?: string | null;
  program_id?: string | null;
  goal_id?: string | null;
  source: "manual" | "dump" | "voice" | "photo" | "program" | "import";
  raw_text?: string | null;
  weather_conditions?: Record<string, unknown> | null;
  is_completed: boolean;
  is_planned: boolean;
  planned_for?: string | null;
  notes?: string | null;
  distance_km?: number | null;
  avg_pace_per_km_seconds?: number | null;
  elevation_gain_m?: number | null;
  max_speed_kmh?: number | null;
  vertical_descent_m?: number | null;
  cadence_avg?: number | null;
  stroke_rate?: number | null;
  swolf?: number | null;
  pool_length_m?: number | null;
  laps?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  sets?: WorkoutSet[];
}

export interface WorkoutSessionCreate {
  session_type: WorkoutSessionType;
  sport_kind?: SportKind | null;
  title: string;
  location?: string | null;
  occurred_on: string;
  duration_minutes?: number | null;
  rpe?: number | null;
  goal_id?: string | null;
  notes?: string | null;
  distance_km?: number | null;
  avg_pace_per_km_seconds?: number | null;
  elevation_gain_m?: number | null;
  pool_length_m?: number | null;
  laps?: number | null;
  swolf?: number | null;
}

export interface WorkoutSessionUpdate {
  title?: string;
  notes?: string | null;
  rpe?: number | null;
  duration_minutes?: number | null;
  goal_id?: string | null;
  is_completed?: boolean;
  distance_km?: number | null;
  avg_pace_per_km_seconds?: number | null;
  elevation_gain_m?: number | null;
}

export interface Superset {
  id: string;
  user_id: string;
  session_id: string;
  group_index: number;
  kind: "superset" | "giantset" | "circuit" | "dropset";
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupersetCreate {
  group_index?: number;
  kind?: "superset" | "giantset" | "circuit" | "dropset";
  notes?: string | null;
  set_ids?: string[];
}
