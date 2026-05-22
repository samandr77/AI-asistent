import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  createHealthMeal,
  createHealthRecipe,
  createHealthSleepLog,
  createHealthWaterLog,
  createHealthWeightLog,
  createHealthWorkout,
  getActiveHealthSleepSession,
  getHealthDashboard,
  getHealthNutritionDiary,
  getHealthNutritionTarget,
  getHealthNutritionWeeklyReport,
  getHealthSleepGoal,
  getHealthSleepStats,
  listHealthRecipes,
  listHealthActivityLogs,
  listHealthSleepLogs,
  listHealthWorkouts,
  listHealthWeightLogs,
  lookupHealthFoodBarcode,
  scanHealthNutritionPhoto,
  searchHealthFoods,
  startHealthSleepSession,
  updateHealthSleepLog,
  upsertHealthNutritionTarget,
  upsertHealthSleepGoal,
  wakeHealthSleepSession,
} from "../../services/api";
import type {
  HealthDashboard,
  HealthFood,
  HealthMealEntry,
  HealthMealType,
  HealthNutritionScanResult,
  HealthSleepLog,
  HealthSleepGoal,
  HealthWorkout,
} from "../../types/api";

import "./health.css";

const today = new Date().toISOString().slice(0, 10);
const metricPrefsKey = "telegram-miniapp:health-dashboard-metrics";

type HealthView = "overview" | "sleep" | "activity" | "workouts" | "nutrition";
type MetricKey =
  | "sleep_duration"
  | "sleep_quality"
  | "steps"
  | "active_minutes"
  | "calories"
  | "protein"
  | "water"
  | "workouts";

const defaultMetrics: MetricKey[] = ["sleep_duration", "steps", "calories"];

const mealLabels: Record<HealthMealType, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

function fmtDate(value?: string | null): string {
  if (!value) return "нет даты";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function fmtFullDate(): string {
  return new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function fmtSleep(minutes?: number | null): { h: number; m: number } {
  const total = minutes ?? 0;
  return { h: Math.floor(total / 60), m: total % 60 };
}

function fmtSleepText(minutes?: number | null): string {
  const { h, m } = fmtSleep(minutes);
  return `${h}ч ${m}м`;
}

function toDatetimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function durationFromLocal(start: string, end: string): number | null {
  const started = new Date(start);
  const ended = new Date(end);
  if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) return null;
  let diff = Math.round((ended.getTime() - started.getTime()) / 60000);
  if (diff <= 0) diff += 1440;
  return diff > 0 ? Math.min(diff, 1440) : null;
}

function sleepTone(duration?: number | null): "good" | "warn" | "low" | "unknown" {
  if (!duration) return "unknown";
  if (duration >= 420 && duration <= 540) return "good";
  if ((duration >= 360 && duration < 420) || (duration > 540 && duration <= 600)) return "warn";
  return "low";
}

function errorText(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.code === "ERR_NETWORK") {
      return "Backend недоступен. Запусти API на http://localhost:8000.";
    }
    if (error.response?.status === 401) {
      return "Нет активной сессии. Открой /launch и создай dev/Telegram-сессию.";
    }
    if (error.response?.status) {
      return `Backend вернул ошибку ${error.response.status}.`;
    }
  }
  return "Не удалось выполнить действие.";
}

function toneClass(severity: string): string {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function readinessLabel(score: number): { text: string; tone: string } {
  if (score >= 80) return { text: "ОТЛИЧНОЕ СОСТОЯНИЕ", tone: "good" };
  if (score >= 60) return { text: "ХОРОШЕЕ СОСТОЯНИЕ", tone: "good" };
  if (score >= 40) return { text: "УМЕРЕННАЯ ГОТОВНОСТЬ", tone: "warn" };
  return { text: "НИЗКАЯ ГОТОВНОСТЬ", tone: "low" };
}

function ScoreRing({ value }: { value: number }) {
  const size = 176;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="health-score-ring" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <linearGradient id="healthScoreG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5BC796" />
            <stop offset="1" stopColor="#0F7A52" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D8ECDF" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#healthScoreG)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(c * safeValue) / 100} ${c}`}
        />
      </svg>
      <div className="health-score-ring__inner">
        <div className="health-score-ring__value">{safeValue}</div>
        <div className="health-score-ring__label">HEALTH SCORE</div>
      </div>
    </div>
  );
}

function ActivityRingsSvg({
  size = 108,
  movement,
  exercise,
  stand,
}: {
  size?: number;
  movement: number;
  exercise: number;
  stand: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rs = [size * 0.4, size * 0.3, size * 0.2];
  const sw = size * 0.085;
  const colors = ["#1F9D6B", "#5BC796", "#A8DDC0"];
  const vals = [movement, exercise, stand];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      {rs.map((r, i) => {
        const c = 2 * Math.PI * r;
        const v = Math.max(0, Math.min(1, vals[i]));
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors[i]} strokeOpacity="0.15" strokeWidth={sw} />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors[i]}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${c * v} ${c}`}
            />
          </g>
        );
      })}
    </svg>
  );
}

function BarWeek({ data, color, max }: { data: number[]; color: string; max: number }) {
  const labels = ["П", "В", "С", "Ч", "П", "С", "В"];
  const padded = [...data];
  while (padded.length < 7) padded.unshift(0);
  const last7 = padded.slice(-7);
  const safeMax = Math.max(max, ...last7, 1);
  return (
    <div className="health-bar-week">
      {last7.map((v, i) => {
        const isToday = i === last7.length - 1;
        return (
          <div key={i} className="health-bar-week__col">
            <div
              className="health-bar-week__bar"
              style={{
                height: `${Math.max(4, (v / safeMax) * 100)}%`,
                background: isToday ? color : "#D8ECDF",
              }}
            />
            <div className={`health-bar-week__label${isToday ? " today" : ""}`}>{labels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="health-section">
      <div className="health-section__head">
        <div>
          <h2>{title}</h2>
          {hint ? <div className="health-section__hint">{hint}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function sleepWeekly(sleep: HealthSleepLog[]): number[] {
  return [...sleep]
    .sort((a, b) => a.sleep_date.localeCompare(b.sleep_date))
    .slice(-7)
    .map((s) => s.duration_minutes ?? 0);
}

function activityWeekly(activity: Array<{ activity_date: string; steps?: number | null }>): number[] {
  return [...activity]
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date))
    .slice(-7)
    .map((a) => a.steps ?? 0);
}

function workoutKindLabel(kind: HealthWorkout["kind"]): string {
  const map: Record<HealthWorkout["kind"], string> = {
    strength: "Силовая",
    cardio: "Кардио",
    yoga: "Йога",
    stretching: "Растяжка",
    walk: "Прогулка",
    sport: "Спорт",
    other: "Другое",
  };
  return map[kind];
}

function MacroBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const safeMax = Math.max(max, 1);
  return (
    <div className="health-macro">
      <div className="health-macro__row">
        <span>{label}</span>
        <span>
          {Math.round(value)}
          {unit} <small>/ {max}</small>
        </span>
      </div>
      <div className="health-macro__bar">
        <div style={{ width: `${Math.min(100, (value / safeMax) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function foodScoreLabel(score?: HealthFood["food_score"]): string {
  if (score === "green") return "зелёный";
  if (score === "red") return "красный";
  return "жёлтый";
}

function dashboardNutrition(dashboard?: HealthDashboard) {
  return (
    dashboard?.nutrition_summary ?? {
      logged_on: today,
      calories: dashboard?.nutrition_today?.calories ?? 0,
      protein_g: dashboard?.nutrition_today?.protein_g ?? 0,
      carbs_g: dashboard?.nutrition_today?.carbs_g ?? 0,
      fat_g: dashboard?.nutrition_today?.fat_g ?? 0,
      fiber_g: 0,
      water_ml: dashboard?.nutrition_today?.water_ml ?? 0,
    }
  );
}

function loadMetricPrefs(): MetricKey[] {
  try {
    const raw = window.localStorage.getItem(metricPrefsKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.filter((item): item is MetricKey =>
        defaultMetrics.concat([
          "sleep_quality",
          "active_minutes",
          "protein",
          "water",
          "workouts",
        ]).includes(item),
      );
    }
  } catch {
    return defaultMetrics;
  }
  return defaultMetrics;
}

export function HealthScreen(): ReactNode {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<HealthView>("overview");
  const [trendTab, setTrendTab] = useState<"7d" | "30d" | "90d">("7d");
  const [metricSettingsOpen, setMetricSettingsOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(loadMetricPrefs);
  const defaultWake = new Date();
  const defaultBed = new Date(defaultWake.getTime() - 8 * 60 * 60 * 1000);
  const [editingSleepId, setEditingSleepId] = useState<string | null>(null);
  const [sleepBedtimeAt, setSleepBedtimeAt] = useState(() => toDatetimeLocal(defaultBed));
  const [sleepWakeAt, setSleepWakeAt] = useState(() => toDatetimeLocal(defaultWake));
  const [sleepDurationOverride, setSleepDurationOverride] = useState<number | "">("");
  const [sleepNotes, setSleepNotes] = useState("");
  const [sleepGoalMinutes, setSleepGoalMinutes] = useState(480);
  const [sleepGoalBedtime, setSleepGoalBedtime] = useState("23:30");
  const [sleepGoalWake, setSleepGoalWake] = useState("07:30");
  const [workoutTitle, setWorkoutTitle] = useState("Силовая тренировка");
  const [workoutKind, setWorkoutKind] = useState<HealthWorkout["kind"]>("strength");
  const [workoutDuration, setWorkoutDuration] = useState(45);
  const [workoutIntensity, setWorkoutIntensity] = useState<number | "">("");
  const [mealType, setMealType] = useState<HealthMealType>("lunch");
  const [mealTitle, setMealTitle] = useState("Обед");
  const [foodName, setFoodName] = useState("Курица, рис, салат");
  const [foodCalories, setFoodCalories] = useState(720);
  const [protein, setProtein] = useState(48);
  const [carbs, setCarbs] = useState(82);
  const [fat, setFat] = useState(18);
  const [waterMl, setWaterMl] = useState(300);
  const nutritionPhotoRef = useRef<HTMLInputElement>(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanResult, setScanResult] = useState<HealthNutritionScanResult | null>(null);
  const [targetSex, setTargetSex] = useState("female");
  const [targetAge, setTargetAge] = useState(30);
  const [targetHeight, setTargetHeight] = useState(170);
  const [targetWeight, setTargetWeight] = useState(70);
  const [targetGoalWeight, setTargetGoalWeight] = useState(68);
  const [targetGoal, setTargetGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [targetActivity, setTargetActivity] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  const [targetDiet, setTargetDiet] = useState<"balanced" | "high_protein" | "keto" | "mediterranean" | "vegan">("balanced");
  const [weightKg, setWeightKg] = useState(70);
  const [recipeTitle, setRecipeTitle] = useState("Домашний рецепт");
  const [recipeServings, setRecipeServings] = useState(2);

  const trendDays = trendTab === "7d" ? 7 : trendTab === "30d" ? 30 : 90;
  const dashboardQuery = useQuery({
    queryKey: ["health", "dashboard", trendDays],
    queryFn: () => getHealthDashboard({ days: trendDays }),
  });
  const sleepQuery = useQuery({ queryKey: ["health", "sleep"], queryFn: listHealthSleepLogs });
  const activeSleepSessionQuery = useQuery({
    queryKey: ["health", "sleep", "active-session"],
    queryFn: getActiveHealthSleepSession,
  });
  const sleepGoalQuery = useQuery({
    queryKey: ["health", "sleep", "goal"],
    queryFn: getHealthSleepGoal,
  });
  const sleepStatsQuery = useQuery({
    queryKey: ["health", "sleep", "stats", trendDays],
    queryFn: () => getHealthSleepStats({ days: trendDays }),
  });
  const activityQuery = useQuery({ queryKey: ["health", "activity"], queryFn: listHealthActivityLogs });
  const workoutsQuery = useQuery({ queryKey: ["health", "workouts"], queryFn: listHealthWorkouts });
  const nutritionQuery = useQuery({
    queryKey: ["health", "nutrition-diary", today],
    queryFn: () => getHealthNutritionDiary({ logged_on: today }),
  });
  const targetQuery = useQuery({ queryKey: ["health", "nutrition-target"], queryFn: getHealthNutritionTarget });
  const foodSearchQuery = useQuery({
    queryKey: ["health", "foods", foodSearch],
    queryFn: () => searchHealthFoods(foodSearch),
    enabled: foodSearch.trim().length >= 2,
  });
  const weightQuery = useQuery({ queryKey: ["health", "nutrition-weight"], queryFn: listHealthWeightLogs });
  const weeklyReportQuery = useQuery({
    queryKey: ["health", "nutrition-report", "weekly"],
    queryFn: getHealthNutritionWeeklyReport,
  });
  const recipesQuery = useQuery({ queryKey: ["health", "nutrition-recipes"], queryFn: listHealthRecipes });

  const invalidateHealth = () => queryClient.invalidateQueries({ queryKey: ["health"] });

  useEffect(() => {
    const goal = sleepGoalQuery.data;
    if (!goal) return;
    setSleepGoalMinutes(goal.target_duration_minutes);
    setSleepGoalBedtime(goal.target_bedtime ?? "");
    setSleepGoalWake(goal.target_wake_time ?? "");
  }, [sleepGoalQuery.data]);

  useEffect(() => {
    const target = targetQuery.data;
    if (!target) return;
    setTargetSex(target.sex ?? targetSex);
    setTargetAge(target.age ?? targetAge);
    setTargetHeight(target.height_cm ?? targetHeight);
    setTargetWeight(target.weight_kg ?? targetWeight);
    setTargetGoalWeight(target.goal_weight_kg ?? targetGoalWeight);
    setTargetGoal(target.goal_type ?? targetGoal);
    setTargetActivity(target.activity_level ?? targetActivity);
    setTargetDiet(target.diet_mode ?? targetDiet);
  }, [targetQuery.data]);

  const sleepMutation = useMutation({
    mutationFn: () => {
      const calculated = durationFromLocal(sleepBedtimeAt, sleepWakeAt);
      const duration = sleepDurationOverride === "" ? calculated : sleepDurationOverride;
      if (!duration) throw new Error("Укажи время лег/встал или длительность сна.");
      const wakeIso = isoFromLocal(sleepWakeAt);
      const sleepDate = wakeIso ? wakeIso.slice(0, 10) : today;
      const payload = {
        sleep_date: sleepDate,
        bedtime_at: isoFromLocal(sleepBedtimeAt),
        wake_at: wakeIso,
        bedtime: sleepBedtimeAt.slice(11, 16),
        wake_time: sleepWakeAt.slice(11, 16),
        source: "manual",
        duration_minutes: duration,
        notes: sleepNotes.trim() || undefined,
      };
      return editingSleepId ? updateHealthSleepLog(editingSleepId, payload) : createHealthSleepLog(payload);
    },
    onSuccess: () => {
      setEditingSleepId(null);
      setSleepDurationOverride("");
      setSleepNotes("");
      void invalidateHealth();
    },
  });

  const startSleepMutation = useMutation({
    mutationFn: () => startHealthSleepSession({ source: "manual" }),
    onSuccess: () => void invalidateHealth(),
  });

  const wakeSleepMutation = useMutation({
    mutationFn: () => {
      const active = activeSleepSessionQuery.data;
      if (!active?.id) throw new Error("Нет активной ночи.");
      return wakeHealthSleepSession(active.id);
    },
    onSuccess: () => void invalidateHealth(),
  });

  const sleepGoalMutation = useMutation({
    mutationFn: () =>
      upsertHealthSleepGoal({
        target_duration_minutes: sleepGoalMinutes,
        target_bedtime: sleepGoalBedtime || null,
        target_wake_time: sleepGoalWake || null,
      } satisfies HealthSleepGoal),
    onSuccess: () => void invalidateHealth(),
  });

  const workoutMutation = useMutation({
    mutationFn: () =>
      createHealthWorkout({
        occurred_on: today,
        title: workoutTitle.trim() || "Тренировка",
        kind: workoutKind,
        duration_minutes: workoutDuration,
        intensity: workoutIntensity === "" ? undefined : workoutIntensity,
        notes:
          workoutIntensity === ""
            ? "Интенсивность не указана пользователем; AI/пользователь уточнит позже."
            : undefined,
      }),
    onSuccess: () => void invalidateHealth(),
  });

  const mealMutation = useMutation({
    mutationFn: () =>
      createHealthMeal({
        logged_on: today,
        meal_type: mealType,
        title: mealTitle.trim() || mealLabels[mealType],
        source: "manual",
        confidence: 1,
        items: [
          {
            name: foodName.trim() || "Еда",
            serving_qty: 1,
            serving_name: "порция",
            calories: foodCalories,
            protein_g: protein,
            carbs_g: carbs,
            fat_g: fat,
          },
        ],
      }),
    onSuccess: () => void invalidateHealth(),
  });

  const waterMutation = useMutation({
    mutationFn: () => createHealthWaterLog({ logged_on: today, amount_ml: waterMl }),
    onSuccess: () => void invalidateHealth(),
  });

  const targetMutation = useMutation({
    mutationFn: () =>
      upsertHealthNutritionTarget({
        sex: targetSex,
        age: targetAge,
        height_cm: targetHeight,
        weight_kg: targetWeight,
        goal_weight_kg: targetGoalWeight,
        goal_type: targetGoal,
        activity_level: targetActivity,
        diet_mode: targetDiet,
      }),
    onSuccess: () => void invalidateHealth(),
  });

  const barcodeMutation = useMutation({
    mutationFn: () => lookupHealthFoodBarcode(barcode),
    onSuccess: (result) => {
      setScanResult(result);
      const food = result.saved_food ?? result.candidate;
      setFoodName(food.name);
      setFoodCalories(Math.round(food.calories_per_100g ?? foodCalories));
      setProtein(Math.round(food.protein_per_100g ?? protein));
      setCarbs(Math.round(food.carbs_per_100g ?? carbs));
      setFat(Math.round(food.fat_per_100g ?? fat));
      void invalidateHealth();
    },
  });

  const photoScanMutation = useMutation({
    mutationFn: (file: File) => scanHealthNutritionPhoto(file),
    onSuccess: (result) => {
      setScanResult(result);
      const food = result.saved_food ?? result.candidate;
      setFoodName(food.name);
      setFoodCalories(Math.round(food.calories_per_100g ?? foodCalories));
      setProtein(Math.round(food.protein_per_100g ?? protein));
      setCarbs(Math.round(food.carbs_per_100g ?? carbs));
      setFat(Math.round(food.fat_per_100g ?? fat));
      void invalidateHealth();
    },
  });

  const weightMutation = useMutation({
    mutationFn: () => createHealthWeightLog({ logged_on: today, weight_kg: weightKg }),
    onSuccess: () => void invalidateHealth(),
  });

  const recipeMutation = useMutation({
    mutationFn: () =>
      createHealthRecipe({
        title: recipeTitle.trim() || foodName.trim() || "Рецепт",
        servings: recipeServings,
        items: [
          {
            name: foodName.trim() || "Ингредиент",
            calories: foodCalories,
            protein_g: protein,
            carbs_g: carbs,
            fat_g: fat,
            serving_name: "рецепт",
            serving_qty: 1,
          },
        ],
      }),
    onSuccess: () => void invalidateHealth(),
  });

  useEffect(() => {
    window.localStorage.setItem(metricPrefsKey, JSON.stringify(selectedMetrics));
  }, [selectedMetrics]);

  const dashboard = dashboardQuery.data;
  const latestSleep = dashboard?.latest_sleep;
  const latestActivity = dashboard?.latest_activity;
  const status = readinessLabel(dashboard?.readiness_score ?? 0);
  const sleepHM = fmtSleep(latestSleep?.duration_minutes);
  const manualSleepMinutes = sleepDurationOverride === "" ? durationFromLocal(sleepBedtimeAt, sleepWakeAt) : sleepDurationOverride;
  const sleepInputHM = fmtSleep(manualSleepMinutes);
  const sleepBars = sleepWeekly(sleepQuery.data ?? []);
  const sleepStats = sleepStatsQuery.data;
  const activeSleepSession = activeSleepSessionQuery.data;
  const activityBars = activityWeekly(activityQuery.data ?? []);
  const movementPct = Math.min(1, (latestActivity?.calories ?? 0) / 530);
  const exercisePct = Math.min(1, (latestActivity?.active_minutes ?? 0) / 30);
  const standPct = Math.min(1, (latestActivity?.stand_hours ?? 0) / 12);
  const nutrition = nutritionQuery.data?.summary ?? dashboardNutrition(dashboard);
  const nutritionTarget = nutrition.target ?? targetQuery.data ?? { calories: 2200, protein_g: 120, carbs_g: 240, fat_g: 75, water_ml: 2500 };
  const calorieGoal = nutritionTarget.calories ?? 2200;
  const remainingCalories = nutrition.remaining_calories ?? Math.max(0, calorieGoal - nutrition.calories);
  const meals = nutritionQuery.data?.meals ?? dashboard?.meals_today ?? [];
  const weightLogs = weightQuery.data ?? [];
  const latestWeight = weightLogs[0];
  const weeklyReport = weeklyReportQuery.data;
  const recipes = recipesQuery.data ?? [];
  const searchedFoods = foodSearchQuery.data ?? [];
  const groupedMeals = useMemo(() => {
    const groups: Record<HealthMealType, HealthMealEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const meal of meals) groups[meal.meal_type]?.push(meal);
    return groups;
  }, [meals]);
  const metricOptions: Array<{
    key: MetricKey;
    label: string;
    value: string;
    hint: string;
  }> = [
    {
      key: "sleep_duration",
      label: "Сон",
      value: `${sleepHM.h}ч ${sleepHM.m}м`,
      hint: latestSleep ? "последняя запись" : "AI рассчитает после записи",
    },
    {
      key: "sleep_quality",
      label: "Качество сна",
      value: latestSleep?.quality_score ? `${latestSleep.quality_score}` : "—",
      hint: "из факторов сна",
    },
    {
      key: "steps",
      label: "Активность",
      value: (latestActivity?.steps ?? 0).toLocaleString("ru-RU"),
      hint: "шагов из AI/трекера",
    },
    {
      key: "active_minutes",
      label: "Минуты",
      value: `${latestActivity?.active_minutes ?? 0}`,
      hint: "активных минут",
    },
    {
      key: "calories",
      label: "Питание",
      value: `${Math.round(nutrition.calories)}`,
      hint: "ккал сегодня",
    },
    {
      key: "protein",
      label: "Белок",
      value: `${Math.round(nutrition.protein_g)}г`,
      hint: "за сегодня",
    },
    {
      key: "water",
      label: "Вода",
      value: `${Math.round(nutrition.water_ml / 100) / 10}л`,
      hint: "за сегодня",
    },
    {
      key: "workouts",
      label: "Тренировки",
      value: `${workoutsQuery.data?.length ?? 0}`,
      hint: "записей",
    },
  ];
  const visibleMetrics = selectedMetrics
    .map((key) => metricOptions.find((item) => item.key === key))
    .filter((item): item is (typeof metricOptions)[number] => Boolean(item));

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== key);
      }
      return [...prev, key].slice(-4);
    });
  }

  return (
    <main className="health-app">
      <header className="health-header">
        <div>
          <div className="health-header__date">{fmtFullDate()}</div>
          <h1 className="health-header__title">Здоровье</h1>
        </div>
      </header>

      {dashboardQuery.isError ? (
        <div className="health-banner health-banner--error">
          {errorText(dashboardQuery.error)}
          <button type="button" onClick={() => void dashboardQuery.refetch()}>
            Повторить
          </button>
        </div>
      ) : null}

      <section className="health-card health-dashboard">
        <div className="health-dashboard__top">
          <div className={`health-status health-status--${status.tone}`}>
            <span className="health-status__dot" />
            {status.text}
          </div>
          <div className="health-trend-tabs">
            {(["7d", "30d", "90d"] as const).map((tab) => (
              <button key={tab} type="button" className={trendTab === tab ? "active" : ""} onClick={() => setTrendTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="health-dashboard__ring">
          <ScoreRing value={dashboard?.score ?? 0} />
        </div>
        <div className="health-dashboard__metrics">
          {visibleMetrics.map((metric) => (
            <div key={metric.key} className="health-mini-metric">
              <div className="health-mini-metric__label">{metric.label}</div>
              <div className="health-mini-metric__value">{metric.value}</div>
              <div className="health-mini-metric__hint">{metric.hint}</div>
            </div>
          ))}
        </div>
        <div className="health-dashboard__settings">
          <button
            type="button"
            className="health-settings-toggle"
            onClick={() => setMetricSettingsOpen((value) => !value)}
          >
            {metricSettingsOpen ? "Скрыть показатели" : "Настроить показатели"}
          </button>
          {metricSettingsOpen ? (
            <div className="health-metric-picker">
              {metricOptions.map((metric) => (
                <label key={metric.key} className="health-metric-picker__item">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(metric.key)}
                    onChange={() => toggleMetric(metric.key)}
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="health-card health-activity">
        <ActivityRingsSvg movement={movementPct} exercise={exercisePct} stand={standPct} />
        <div className="health-activity__legend">
          <div className="health-activity__row">
            <div className="health-activity__line">
              <span className="health-dot" style={{ background: "#1F9D6B" }} />
              <span>Движение</span>
              <small>ккал</small>
            </div>
            <div className="health-activity__value">{latestActivity?.calories ?? 0} / 530</div>
          </div>
          <div className="health-activity__row">
            <div className="health-activity__line">
              <span className="health-dot" style={{ background: "#5BC796" }} />
              <span>Упражнения</span>
              <small>мин</small>
            </div>
            <div className="health-activity__value">{latestActivity?.active_minutes ?? 0} / 30</div>
          </div>
          <div className="health-activity__row">
            <div className="health-activity__line">
              <span className="health-dot" style={{ background: "#A8DDC0" }} />
              <span>Стояние</span>
              <small>ч</small>
            </div>
            <div className="health-activity__value">{latestActivity?.stand_hours ?? 0} / 12</div>
          </div>
        </div>
      </section>

      {activeView === "overview" ? (
        <>
          <Section title="Разделы" hint="нажми, чтобы открыть подробности и записи">
            <div className="health-modules">
              <button type="button" className="health-card health-module health-module-button" onClick={() => setActiveView("sleep")}>
                <div className="health-module__head">
                  <div className="health-module__icon health-module__icon--violet">🌙</div>
                  <div className="health-module__title">
                    <div className="health-module__name-row">
                      <h3>Сон</h3>
                      <div className="health-module__metric" style={{ color: "#7B6FD8" }}>
                        {sleepHM.h}ч {sleepHM.m}м
                      </div>
                    </div>
                    <div className="health-module__sub-row">
                      <span>{latestSleep?.quality_score ? `качество ${latestSleep.quality_score}/100` : "нет записи"}</span>
                      <small>открыть</small>
                    </div>
                  </div>
                </div>
              </button>
              <button type="button" className="health-card health-module health-module-button" onClick={() => setActiveView("activity")}>
                <div className="health-module__head">
                  <div className="health-module__icon health-module__icon--green">🚶</div>
                  <div className="health-module__title">
                    <div className="health-module__name-row">
                      <h3>Активность</h3>
                      <div className="health-module__metric" style={{ color: "#1F9D6B" }}>
                        {(latestActivity?.steps ?? 0).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <div className="health-module__sub-row">
                      <span>шаги, минуты и кольца</span>
                      <small>открыть</small>
                    </div>
                  </div>
                </div>
              </button>
              <button type="button" className="health-card health-module health-module-button" onClick={() => setActiveView("nutrition")}>
                <div className="health-module__head">
                  <div className="health-module__icon health-module__icon--amber">🍎</div>
                  <div className="health-module__title">
                    <div className="health-module__name-row">
                      <h3>Питание</h3>
                      <div className="health-module__metric" style={{ color: "#A8651F" }}>
                        {Math.round(nutrition.calories)} ккал
                      </div>
                    </div>
                    <div className="health-module__sub-row">
                      <span>{meals.length ? `${meals.length} записей` : "дневник пуст"}</span>
                      <small>открыть</small>
                    </div>
                  </div>
                </div>
              </button>
              <button type="button" className="health-card health-module health-module-button" onClick={() => setActiveView("workouts")}>
                <div className="health-module__head">
                  <div className="health-module__icon health-module__icon--red">🏋</div>
                  <div className="health-module__title">
                    <div className="health-module__name-row">
                      <h3>Тренировки</h3>
                      <div className="health-module__metric" style={{ color: "#C2553F" }}>
                        {workoutsQuery.data?.length ?? 0}
                      </div>
                    </div>
                    <div className="health-module__sub-row">
                      <span>{workoutsQuery.data?.[0]?.title ?? "нет тренировок"}</span>
                      <small>открыть</small>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </Section>
        </>
      ) : (
        <div className="health-back-panel">
          <button type="button" className="health-back-button" onClick={() => setActiveView("overview")}>
            ← Главная здоровья
          </button>
        </div>
      )}

      {activeView === "sleep" ? (
        <Section title="Сон" hint="записывай лег/встал, редактируй ночи и смотри режим">
          <section className="health-card health-sleep">
            <div className="health-sleep__head">
              <div className="health-sleep__title-row">
                <div className="health-sleep__icon">🌙</div>
                <div>
                  <div className="health-card-title">Текущая ночь</div>
                  <div className="health-card-sub">
                    {activeSleepSession
                      ? `идет с ${new Date(activeSleepSession.started_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
                      : "нажми Иду спать, а утром Проснулся"}
                  </div>
                </div>
              </div>
              {latestSleep?.quality_score ? <div className="health-pill">{latestSleep.quality_score}/100</div> : null}
            </div>
            <div className="health-sleep-actions">
              <button
                type="button"
                className="health-cta health-cta--ghost"
                disabled={Boolean(activeSleepSession) || startSleepMutation.isPending}
                onClick={() => startSleepMutation.mutate()}
              >
                {startSleepMutation.isPending ? "Записываю…" : "Иду спать"}
              </button>
              <button
                type="button"
                className="health-cta"
                disabled={!activeSleepSession || wakeSleepMutation.isPending}
                onClick={() => wakeSleepMutation.mutate()}
              >
                {wakeSleepMutation.isPending ? "Сохраняю ночь…" : "Проснулся"}
              </button>
            </div>
            {startSleepMutation.isError ? <div className="health-form-error">{errorText(startSleepMutation.error)}</div> : null}
            {wakeSleepMutation.isError ? <div className="health-form-error">{errorText(wakeSleepMutation.error)}</div> : null}
          </section>

          <form
            className="health-card health-entry"
            onSubmit={(event) => {
              event.preventDefault();
              sleepMutation.mutate();
            }}
          >
            <div>
              <div className="health-card-title">{editingSleepId ? "Редактировать ночь" : "Добавить ночь вручную"}</div>
              <div className="health-card-sub">ручная форма нужна для исправлений; основной ввод может идти через AI</div>
            </div>
            <div className="health-fields">
              <label>
                <span>Лег</span>
                <input type="datetime-local" value={sleepBedtimeAt} onChange={(event) => setSleepBedtimeAt(event.target.value)} />
              </label>
              <label>
                <span>Встал</span>
                <input type="datetime-local" value={sleepWakeAt} onChange={(event) => setSleepWakeAt(event.target.value)} />
              </label>
              <label>
                <span>Длительность, мин</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder={manualSleepMinutes ? String(manualSleepMinutes) : "авто"}
                  value={sleepDurationOverride}
                  onChange={(event) => setSleepDurationOverride(event.target.value ? Number(event.target.value) : "")}
                />
              </label>
              <label className="health-field-wide">
                <span>Заметка</span>
                <input value={sleepNotes} onChange={(event) => setSleepNotes(event.target.value)} placeholder="необязательно" />
              </label>
            </div>
            <div className={`health-sleep-summary health-sleep-summary--${sleepTone(manualSleepMinutes)}`}>
              <span>{fmtSleepText(manualSleepMinutes)}</span>
              <small>score будет рассчитан из длительности и регулярности</small>
            </div>
            <button type="submit" disabled={sleepMutation.isPending} className="health-cta health-cta--ghost">
              {sleepMutation.isPending ? "Сохраняю сон…" : editingSleepId ? "Сохранить изменения" : "Сохранить ночь"}
            </button>
            {editingSleepId ? (
              <button
                type="button"
                className="health-cta health-cta--ghost"
                onClick={() => {
                  setEditingSleepId(null);
                  setSleepDurationOverride("");
                  setSleepNotes("");
                }}
              >
                Отменить редактирование
              </button>
            ) : null}
            {sleepMutation.isError ? <div className="health-form-error">{errorText(sleepMutation.error)}</div> : null}
          </form>

          <form
            className="health-card health-entry"
            onSubmit={(event) => {
              event.preventDefault();
              sleepGoalMutation.mutate();
            }}
          >
            <div>
              <div className="health-card-title">Цель сна</div>
              <div className="health-card-sub">минимум сна и желаемое окно режима</div>
            </div>
            <div className="health-fields">
              <label>
                <span>Минут сна</span>
                <input type="number" min="240" max="720" value={sleepGoalMinutes} onChange={(event) => setSleepGoalMinutes(Number(event.target.value))} />
              </label>
              <label>
                <span>Ложиться до</span>
                <input type="time" value={sleepGoalBedtime} onChange={(event) => setSleepGoalBedtime(event.target.value)} />
              </label>
              <label>
                <span>Вставать около</span>
                <input type="time" value={sleepGoalWake} onChange={(event) => setSleepGoalWake(event.target.value)} />
              </label>
            </div>
            <button type="submit" disabled={sleepGoalMutation.isPending} className="health-cta health-cta--ghost">
              {sleepGoalMutation.isPending ? "Сохраняю цель…" : "Сохранить цель сна"}
            </button>
            {sleepGoalMutation.isError ? <div className="health-form-error">{errorText(sleepGoalMutation.error)}</div> : null}
          </form>

          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--violet">📈</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Аналитика сна</h3>
                  <div className="health-module__metric" style={{ color: "#7B6FD8" }}>
                    {sleepStats?.average_score ?? 0}
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>средний score · серия {sleepStats?.good_sleep_streak ?? 0}</span>
                  <small>{trendTab}</small>
                </div>
              </div>
            </div>
            <div className="health-bio-grid">
              <div className="health-bio-cell">
                <div className="health-bio-cell__label">Средний сон</div>
                <div className="health-bio-cell__value">{fmtSleepText(sleepStats?.average_duration_minutes)}</div>
              </div>
              <div className="health-bio-cell">
                <div className="health-bio-cell__label">Регулярность</div>
                <div className="health-bio-cell__value">
                  {sleepStats?.average_midpoint_deviation_minutes ?? "—"} <small>мин</small>
                </div>
              </div>
              <div className="health-bio-cell">
                <div className="health-bio-cell__label">Цель</div>
                <div className="health-bio-cell__value">{fmtSleepText(sleepStats?.target_duration_minutes ?? sleepGoalMinutes)}</div>
              </div>
              <div className="health-bio-cell">
                <div className="health-bio-cell__label">Ночей</div>
                <div className="health-bio-cell__value">{sleepStats?.nights_count ?? 0}</div>
              </div>
            </div>
            <BarWeek data={sleepStats?.series.map((item) => item.duration_minutes) ?? sleepBars} color="#7B6FD8" max={540} />
          </article>

          <div className="health-insights">
            {(sleepStats?.tips ?? []).map((tip) => (
              <article key={tip.id} className={`health-insight health-insight--${toneClass(tip.severity)}`}>
                <div className="health-insight__head">
                  <span className="health-insight__tag">сон</span>
                </div>
                <h3>{tip.title}</h3>
                <p>{tip.message}</p>
                {tip.suggested_action ? <div className="health-insight__action">{tip.suggested_action}</div> : null}
              </article>
            ))}
          </div>

          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--violet">📓</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>История сна</h3>
                  <div className="health-module__metric" style={{ color: "#7B6FD8" }}>
                    {sleepQuery.data?.length ?? 0}
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>записи ночей и редактирование</span>
                </div>
              </div>
            </div>
            {sleepQuery.data?.length ? (
              <div className="health-module__list">
                {sleepQuery.data.slice(0, 10).map((sleep) => (
                  <div key={sleep.id} className={`health-module__list-row health-sleep-row--${sleepTone(sleep.duration_minutes)}`}>
                    <div className="health-module__list-name">
                      {fmtDate(sleep.sleep_date)} <small>· {sleep.bedtime ?? "—"} - {sleep.wake_time ?? "—"}</small>
                    </div>
                    <div className="health-module__list-meta">
                      {fmtSleepText(sleep.duration_minutes)} · {sleep.quality_score ?? "—"}/100
                      <button
                        type="button"
                        className="health-inline-button"
                        onClick={() => {
                          setEditingSleepId(sleep.id);
                          setSleepBedtimeAt(sleep.bedtime_at ? toDatetimeLocal(new Date(sleep.bedtime_at)) : sleepBedtimeAt);
                          setSleepWakeAt(sleep.wake_at ? toDatetimeLocal(new Date(sleep.wake_at)) : sleepWakeAt);
                          setSleepDurationOverride(sleep.duration_minutes);
                          setSleepNotes(sleep.notes ?? "");
                        }}
                      >
                        Изменить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="health-empty health-empty--inline">Записей сна пока нет.</div>
            )}
          </article>
        </Section>
      ) : null}

      {activeView === "activity" ? (
      <Section title="Активность" hint="активность приходит из AI-записей, голосом или фото">
        <div className="health-modules">
          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--green">🚶</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Активность</h3>
                  <div className="health-module__metric" style={{ color: "#1F9D6B" }}>
                    {(latestActivity?.steps ?? 0).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>шаги, минуты, калории и стояние из AI-ввода</span>
                  <small>{fmtDate(latestActivity?.activity_date)}</small>
                </div>
              </div>
            </div>
            <BarWeek data={activityBars} color="#1F9D6B" max={10000} />
          </article>
        </div>
      </Section>
      ) : null}

      {activeView === "workouts" ? (
      <Section title="Тренировки" hint="RPE: 1-4 легко · 5-6 можно говорить · 7-8 говорить трудно · 9-10 максимум">
        <div className="health-modules">
          <form
            className="health-card health-entry"
            onSubmit={(event) => {
              event.preventDefault();
              workoutMutation.mutate();
            }}
          >
            <div>
              <div className="health-card-title">Тренировка</div>
              <div className="health-card-sub">RPE: 1-4 легко · 5-6 можно говорить · 7-8 говорить трудно · 9-10 максимум</div>
            </div>
            <div className="health-fields">
              <label className="health-field-wide">
                <span>Название</span>
                <input value={workoutTitle} onChange={(event) => setWorkoutTitle(event.target.value)} />
              </label>
              <label>
                <span>Тип</span>
                <select value={workoutKind} onChange={(event) => setWorkoutKind(event.target.value as HealthWorkout["kind"])}>
                  <option value="strength">Силовая</option>
                  <option value="cardio">Кардио</option>
                  <option value="yoga">Йога</option>
                  <option value="stretching">Растяжка</option>
                  <option value="walk">Прогулка</option>
                  <option value="sport">Спорт</option>
                  <option value="other">Другое</option>
                </select>
              </label>
              <label>
                <span>Минуты</span>
                <input type="number" min="1" value={workoutDuration} onChange={(event) => setWorkoutDuration(Number(event.target.value))} />
              </label>
              <label>
                <span>Интенсивность</span>
                <input type="number" min="1" max="10" placeholder="не знаю" value={workoutIntensity} onChange={(event) => setWorkoutIntensity(event.target.value ? Number(event.target.value) : "")} />
              </label>
            </div>
            <button type="submit" disabled={workoutMutation.isPending} className="health-cta health-cta--ghost">
              {workoutMutation.isPending ? "Сохраняю тренировку…" : "Сохранить тренировку"}
            </button>
            {workoutMutation.isError ? <div className="health-form-error">{errorText(workoutMutation.error)}</div> : null}
          </form>
          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--red">🏋</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Записи тренировок</h3>
                  <div className="health-module__metric" style={{ color: "#C2553F" }}>
                    {workoutsQuery.data?.length ?? 0}
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>последние тренировки</span>
                </div>
              </div>
            </div>
            {workoutsQuery.data?.length ? (
              <div className="health-module__list">
                {workoutsQuery.data.slice(0, 5).map((workout) => (
                  <div key={workout.id} className="health-module__list-row">
                    <div className="health-module__list-name">
                      {workout.title} <small>· {workoutKindLabel(workout.kind)}</small>
                    </div>
                    <div className="health-module__list-meta">
                      {fmtDate(workout.occurred_on)}
                      {workout.duration_minutes ? ` · ${workout.duration_minutes} мин` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="health-empty health-empty--inline">Тренировок пока нет.</div>
            )}
          </article>
        </div>
      </Section>
      ) : null}

      {activeView === "nutrition" ? (
        <Section title="Питание" hint="дневник, база продуктов, фото упаковки, цели, вода, вес и недельная сводка">
          <article className="health-card health-module health-nutrition-hero">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--amber">🍎</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Сегодня</h3>
                  <div className="health-module__metric" style={{ color: "#A8651F" }}>
                    {Math.round((nutrition.calories / calorieGoal) * 100)}%
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>{Math.round(nutrition.calories)} / {calorieGoal} ккал</span>
                  <small>осталось {Math.round(remainingCalories)} ккал</small>
                </div>
              </div>
            </div>
            <div className="health-macros">
              <MacroBar label="Белки" value={nutrition.protein_g} max={nutritionTarget.protein_g ?? 120} unit="г" color="#C2553F" />
              <MacroBar label="Жиры" value={nutrition.fat_g} max={nutritionTarget.fat_g ?? 75} unit="г" color="#D98A2B" />
              <MacroBar label="Углев." value={nutrition.carbs_g} max={nutritionTarget.carbs_g ?? 240} unit="г" color="#A8651F" />
              <MacroBar label="Вода" value={nutrition.water_ml / 1000} max={(nutritionTarget.water_ml ?? 2500) / 1000} unit="л" color="#3A8FD8" />
            </div>
            <div className="health-nutrition-stats">
              <span>клетчатка {Math.round(nutrition.fiber_g)} г</span>
              <span>{meals.length} записей еды</span>
              <span>вода {Math.round(nutrition.water_ml / 100) / 10} л</span>
            </div>
          </article>

          <div className="health-entry-grid">
            <form
              className="health-card health-entry"
              onSubmit={(event) => {
                event.preventDefault();
                mealMutation.mutate();
              }}
            >
              <div>
                <div className="health-card-title">Добавить еду</div>
                <div className="health-card-sub">ручной ввод, поиск, barcode или AI-фото упаковки</div>
              </div>
              <div className="health-fields">
                <label>
                  <span>Приём</span>
                  <select value={mealType} onChange={(event) => setMealType(event.target.value as HealthMealType)}>
                    {Object.entries(mealLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Название</span>
                  <input value={mealTitle} onChange={(event) => setMealTitle(event.target.value)} />
                </label>
                <label className="health-field-wide">
                  <span>Еда</span>
                  <input value={foodName} onChange={(event) => setFoodName(event.target.value)} />
                </label>
                <label>
                  <span>Ккал</span>
                  <input type="number" min="0" value={foodCalories} onChange={(event) => setFoodCalories(Number(event.target.value))} />
                </label>
                <label>
                  <span>Белки</span>
                  <input type="number" min="0" value={protein} onChange={(event) => setProtein(Number(event.target.value))} />
                </label>
                <label>
                  <span>Углеводы</span>
                  <input type="number" min="0" value={carbs} onChange={(event) => setCarbs(Number(event.target.value))} />
                </label>
                <label>
                  <span>Жиры</span>
                  <input type="number" min="0" value={fat} onChange={(event) => setFat(Number(event.target.value))} />
                </label>
              </div>
              <div className="health-action-row">
                <button type="submit" disabled={mealMutation.isPending} className="health-cta health-cta--ghost">
                  {mealMutation.isPending ? "Сохраняю еду…" : "Сохранить еду"}
                </button>
                <button type="button" className="health-cta health-cta--ghost" disabled={recipeMutation.isPending} onClick={() => recipeMutation.mutate()}>
                  {recipeMutation.isPending ? "Сохраняю рецепт…" : "В рецепт"}
                </button>
              </div>
              {mealMutation.isError ? <div className="health-form-error">{errorText(mealMutation.error)}</div> : null}
              {recipeMutation.isError ? <div className="health-form-error">{errorText(recipeMutation.error)}</div> : null}
            </form>

            <div className="health-card health-entry">
              <div>
                <div className="health-card-title">База и фото упаковки</div>
                <div className="health-card-sub">Open Food Facts + AI извлекает КБЖУ с этикетки</div>
              </div>
              <input
                ref={nutritionPhotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) photoScanMutation.mutate(file);
                }}
              />
              <div className="health-fields">
                <label className="health-field-wide">
                  <span>Поиск продукта</span>
                  <input value={foodSearch} onChange={(event) => setFoodSearch(event.target.value)} placeholder="йогурт, гречка, протеин" />
                </label>
                <label className="health-field-wide">
                  <span>Штрихкод</span>
                  <input value={barcode} onChange={(event) => setBarcode(event.target.value)} inputMode="numeric" placeholder="EAN/UPC" />
                </label>
              </div>
              <div className="health-action-row">
                <button type="button" className="health-cta health-cta--ghost" disabled={!barcode || barcodeMutation.isPending} onClick={() => barcodeMutation.mutate()}>
                  {barcodeMutation.isPending ? "Ищу…" : "Найти по коду"}
                </button>
                <button type="button" className="health-cta" disabled={photoScanMutation.isPending} onClick={() => nutritionPhotoRef.current?.click()}>
                  {photoScanMutation.isPending ? "Анализирую…" : "Фото упаковки"}
                </button>
              </div>
              {scanResult ? (
                <div className="health-scan-result">
                  <strong>{scanResult.candidate.name}</strong>
                  <span>{scanResult.source} · confidence {Math.round((scanResult.confidence ?? 0) * 100)}% · {foodScoreLabel(scanResult.candidate.food_score)}</span>
                  <small>{scanResult.needs_confirmation ? "проверь значения перед сохранением" : "можно добавлять в дневник"}</small>
                </div>
              ) : null}
              {foodSearchQuery.isFetching ? <div className="health-card-sub">Ищу продукты…</div> : null}
              {searchedFoods.length ? (
                <div className="health-module__list">
                  {searchedFoods.slice(0, 5).map((food, index) => (
                    <button
                      key={`${food.id ?? food.barcode ?? food.name}-${index}`}
                      type="button"
                      className="health-food-row"
                      onClick={() => {
                        setFoodName(food.name);
                        setFoodCalories(Math.round(food.calories_per_100g ?? 0));
                        setProtein(Math.round(food.protein_per_100g ?? 0));
                        setCarbs(Math.round(food.carbs_per_100g ?? 0));
                        setFat(Math.round(food.fat_per_100g ?? 0));
                        setScanResult({ candidate: food, saved_food: food, needs_confirmation: !food.is_confirmed, source: food.source, confidence: food.confidence });
                      }}
                    >
                      <span>{food.name}</span>
                      <small>{Math.round(food.calories_per_100g ?? 0)} ккал · {foodScoreLabel(food.food_score)}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              {barcodeMutation.isError ? <div className="health-form-error">{errorText(barcodeMutation.error)}</div> : null}
              {photoScanMutation.isError ? <div className="health-form-error">{errorText(photoScanMutation.error)}</div> : null}
            </div>

            <form
              className="health-card health-entry"
              onSubmit={(event) => {
                event.preventDefault();
                targetMutation.mutate();
              }}
            >
              <div>
                <div className="health-card-title">Цель TDEE</div>
                <div className="health-card-sub">Миффлин-Сан Жеор + режим питания</div>
              </div>
              <div className="health-fields">
                <label>
                  <span>Пол</span>
                  <select value={targetSex} onChange={(event) => setTargetSex(event.target.value)}>
                    <option value="female">Жен.</option>
                    <option value="male">Муж.</option>
                  </select>
                </label>
                <label>
                  <span>Возраст</span>
                  <input type="number" min="13" value={targetAge} onChange={(event) => setTargetAge(Number(event.target.value))} />
                </label>
                <label>
                  <span>Рост</span>
                  <input type="number" min="90" value={targetHeight} onChange={(event) => setTargetHeight(Number(event.target.value))} />
                </label>
                <label>
                  <span>Вес</span>
                  <input type="number" min="25" value={targetWeight} onChange={(event) => setTargetWeight(Number(event.target.value))} />
                </label>
                <label>
                  <span>Цель веса</span>
                  <input type="number" min="25" value={targetGoalWeight} onChange={(event) => setTargetGoalWeight(Number(event.target.value))} />
                </label>
                <label>
                  <span>Цель</span>
                  <select value={targetGoal} onChange={(event) => setTargetGoal(event.target.value as typeof targetGoal)}>
                    <option value="lose">Снизить</option>
                    <option value="maintain">Держать</option>
                    <option value="gain">Набрать</option>
                  </select>
                </label>
                <label>
                  <span>Активность</span>
                  <select value={targetActivity} onChange={(event) => setTargetActivity(event.target.value as typeof targetActivity)}>
                    <option value="sedentary">Низкая</option>
                    <option value="light">Лёгкая</option>
                    <option value="moderate">Средняя</option>
                    <option value="active">Высокая</option>
                    <option value="very_active">Очень высокая</option>
                  </select>
                </label>
                <label>
                  <span>Режим</span>
                  <select value={targetDiet} onChange={(event) => setTargetDiet(event.target.value as typeof targetDiet)}>
                    <option value="balanced">Баланс</option>
                    <option value="high_protein">Больше белка</option>
                    <option value="keto">Кето</option>
                    <option value="mediterranean">Средиземн.</option>
                    <option value="vegan">Веган</option>
                  </select>
                </label>
              </div>
              <button type="submit" disabled={targetMutation.isPending} className="health-cta health-cta--ghost">
                {targetMutation.isPending ? "Считаю цель…" : "Рассчитать цель"}
              </button>
              {targetQuery.data?.bmr ? <div className="health-card-sub">BMR {targetQuery.data.bmr} · TDEE {targetQuery.data.tdee}</div> : null}
              {targetMutation.isError ? <div className="health-form-error">{errorText(targetMutation.error)}</div> : null}
            </form>

            <form
              className="health-card health-entry"
              onSubmit={(event) => {
                event.preventDefault();
                waterMutation.mutate();
              }}
            >
              <div>
                <div className="health-card-title">Вода и вес</div>
                <div className="health-card-sub">быстрые записи для отчёта и прогресса</div>
              </div>
              <div className="health-water-buttons">
                {[200, 300, 500].map((amount) => (
                  <button key={amount} type="button" className="health-chip-button" onClick={() => setWaterMl(amount)}>
                    {amount} мл
                  </button>
                ))}
              </div>
              <label>
                <span>Мл воды</span>
                <input type="number" min="1" value={waterMl} onChange={(event) => setWaterMl(Number(event.target.value))} />
              </label>
              <button type="submit" disabled={waterMutation.isPending} className="health-cta health-cta--ghost">
                {waterMutation.isPending ? "Добавляю воду…" : "Добавить воду"}
              </button>
              <label>
                <span>Вес, кг</span>
                <input type="number" min="25" step="0.1" value={weightKg} onChange={(event) => setWeightKg(Number(event.target.value))} />
              </label>
              <button type="button" disabled={weightMutation.isPending} className="health-cta health-cta--ghost" onClick={() => weightMutation.mutate()}>
                {weightMutation.isPending ? "Сохраняю вес…" : "Сохранить вес"}
              </button>
              <div className="health-card-sub">
                {latestWeight ? `текущий ${latestWeight.weight_kg} кг · записей ${weightLogs.length}` : "вес ещё не записан"}
              </div>
              {waterMutation.isError ? <div className="health-form-error">{errorText(waterMutation.error)}</div> : null}
              {weightMutation.isError ? <div className="health-form-error">{errorText(weightMutation.error)}</div> : null}
            </form>
          </div>

          <div className="health-modules">
            {(Object.keys(mealLabels) as HealthMealType[]).map((type) => (
              <article key={type} className="health-card health-module">
                <div className="health-module__head">
                  <div className="health-module__icon health-module__icon--amber">🍽</div>
                  <div className="health-module__title">
                    <div className="health-module__name-row">
                      <h3>{mealLabels[type]}</h3>
                      <div className="health-module__metric" style={{ color: "#A8651F" }}>
                        {groupedMeals[type].reduce((sum, meal) => sum + meal.items.reduce((iSum, item) => iSum + (item.calories ?? 0), 0), 0)} ккал
                      </div>
                    </div>
                    <div className="health-module__sub-row">
                      <span>{groupedMeals[type].length ? `${groupedMeals[type].length} записей` : "пока пусто"}</span>
                    </div>
                  </div>
                </div>
                {groupedMeals[type].length ? (
                  <div className="health-module__list">
                    {groupedMeals[type].flatMap((meal) =>
                      meal.items.map((item) => (
                        <div key={item.id} className="health-module__list-row">
                          <div className="health-module__list-name">
                            {item.name} <small>· {item.serving_name}</small>
                          </div>
                          <div className="health-module__list-meta">{Math.round(item.calories ?? 0)} ккал</div>
                        </div>
                      )),
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="health-entry-grid">
            <article className="health-card health-entry">
              <div>
                <div className="health-card-title">Недельный отчёт</div>
                <div className="health-card-sub">{weeklyReport?.week_start} — {weeklyReport?.week_end}</div>
              </div>
              {weeklyReport ? (
                <>
                  <div className="health-bio-grid">
                    <div className="health-bio-cell">
                      <div className="health-bio-cell__label">Ккал/день</div>
                      <div className="health-bio-cell__value">{Math.round(weeklyReport.average_calories)}</div>
                    </div>
                    <div className="health-bio-cell">
                      <div className="health-bio-cell__label">Белок</div>
                      <div className="health-bio-cell__value">{Math.round(weeklyReport.average_protein_g)}г</div>
                    </div>
                    <div className="health-bio-cell">
                      <div className="health-bio-cell__label">Вода</div>
                      <div className="health-bio-cell__value">{Math.round(weeklyReport.average_water_ml)}мл</div>
                    </div>
                    <div className="health-bio-cell">
                      <div className="health-bio-cell__label">Вес</div>
                      <div className="health-bio-cell__value">{weeklyReport.weight_trend_kg ?? "—"}</div>
                    </div>
                  </div>
                  <p className="health-report-text">{weeklyReport.ai_summary}</p>
                  {weeklyReport.frequent_foods.length ? (
                    <div className="health-card-sub">часто: {weeklyReport.frequent_foods.map((food) => food.name).join(", ")}</div>
                  ) : null}
                </>
              ) : (
                <div className="health-empty">Отчёт появится после записей питания.</div>
              )}
            </article>
            <article className="health-card health-entry">
              <div>
                <div className="health-card-title">Рецепты</div>
                <div className="health-card-sub">сохраняй домашние блюда и добавляй повторно</div>
              </div>
              <div className="health-fields">
                <label>
                  <span>Название</span>
                  <input value={recipeTitle} onChange={(event) => setRecipeTitle(event.target.value)} />
                </label>
                <label>
                  <span>Порций</span>
                  <input type="number" min="1" value={recipeServings} onChange={(event) => setRecipeServings(Number(event.target.value))} />
                </label>
              </div>
              <div className="health-module__list">
                {recipes.slice(0, 4).map((recipe) => (
                  <div key={recipe.id} className="health-module__list-row">
                    <div className="health-module__list-name">{recipe.title}</div>
                    <div className="health-module__list-meta">{Math.round(recipe.calories_per_serving ?? 0)} ккал</div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </Section>
      ) : null}

      {activeView === "overview" ? (
      <Section title="AI-инсайты по здоровью" hint="LLM анализирует сон, активность, тренировки и питание; это не диагностика">
        {(dashboard?.insights ?? []).length ? (
          <div className="health-insights">
            {(dashboard?.insights ?? []).map((insight, idx) => (
              <article key={insight.id} className={`health-insight health-insight--${toneClass(insight.severity)}`}>
                <div className="health-insight__head">
                  <span className="health-insight__tag">
                    {insight.severity === "critical" ? "важно" : insight.severity === "warning" ? "внимание" : "паттерн"}
                  </span>
                  <span className="health-insight__counter">
                    {idx + 1}/{dashboard?.insights.length}
                  </span>
                </div>
                <h3>{insight.title}</h3>
                <p>{insight.message}</p>
                {insight.suggested_action ? <div className="health-insight__action">{insight.suggested_action}</div> : null}
                {insight.used_data?.length ? <div className="health-insight__refs">{insight.used_data.join(" · ")}</div> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="health-empty">Добавь сон, активность, тренировку или питание, чтобы LLM собрал безопасные подсказки.</div>
        )}
      </Section>
      ) : null}

      {activeView === "overview" ? (
      <Section title="Тренды" hint="быстрый обзор последних 7 дней">
        <div className="health-modules">
          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--violet">🌙</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Сон</h3>
                  <div className="health-module__metric" style={{ color: "#7B6FD8" }}>
                    {sleepHM.h}ч {sleepHM.m}м
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>{sleepQuery.data?.length ?? 0} записей · {fmtDate(sleepQuery.data?.[0]?.sleep_date)}</span>
                </div>
              </div>
            </div>
            <BarWeek data={sleepBars} color="#7B6FD8" max={520} />
          </article>
          <article className="health-card health-module">
            <div className="health-module__head">
              <div className="health-module__icon health-module__icon--red">🏋</div>
              <div className="health-module__title">
                <div className="health-module__name-row">
                  <h3>Тренировки</h3>
                  <div className="health-module__metric" style={{ color: "#C2553F" }}>
                    {workoutsQuery.data?.length ?? 0}
                  </div>
                </div>
                <div className="health-module__sub-row">
                  <span>{workoutsQuery.data?.[0]?.title ?? "нет тренировок"}</span>
                </div>
              </div>
            </div>
            {workoutsQuery.data?.length ? (
              <div className="health-module__list">
                {workoutsQuery.data.slice(0, 3).map((workout) => (
                  <div key={workout.id} className="health-module__list-row">
                    <div className="health-module__list-name">
                      {workout.title} <small>· {workoutKindLabel(workout.kind)}</small>
                    </div>
                    <div className="health-module__list-meta">
                      {fmtDate(workout.occurred_on)}
                      {workout.duration_minutes ? ` · ${workout.duration_minutes} мин` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </Section>
      ) : null}
    </main>
  );
}
