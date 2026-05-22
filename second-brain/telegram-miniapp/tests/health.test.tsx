import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HealthScreen } from "../src/screens/health/HealthScreen";
import {
  getHealthDashboard,
  getHealthNutritionDiary,
  getHealthSleepGoal,
  getHealthSleepStats,
  getActiveHealthSleepSession,
  listHealthActivityLogs,
  listHealthSleepLogs,
  listHealthWorkouts,
} from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    createHealthMeal: vi.fn(),
    createHealthSleepLog: vi.fn(),
    createHealthWaterLog: vi.fn(),
    createHealthWorkout: vi.fn(),
    getActiveHealthSleepSession: vi.fn(),
    getHealthDashboard: vi.fn(),
    getHealthNutritionDiary: vi.fn(),
    getHealthSleepGoal: vi.fn(),
    getHealthSleepStats: vi.fn(),
    listHealthActivityLogs: vi.fn(),
    listHealthSleepLogs: vi.fn(),
    listHealthWorkouts: vi.fn(),
    startHealthSleepSession: vi.fn(),
    updateHealthSleepLog: vi.fn(),
    upsertHealthSleepGoal: vi.fn(),
    wakeHealthSleepSession: vi.fn(),
  };
});

const now = "2026-05-21T00:00:00+00:00";

function renderHealth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthScreen />
    </QueryClientProvider>,
  );
}

describe("HealthScreen", () => {
  it("renders health dashboard, insights, and manual entry forms", async () => {
    vi.mocked(getHealthDashboard).mockResolvedValue({
      score: 74,
      readiness_score: 69,
      trend_days: 30,
      latest_daily_log: {
        id: "daily-1",
        user_id: "u1",
        log_date: "2026-05-21",
        mood: 7,
        energy: 6,
        stress: 4,
        readiness_override: null,
        symptoms: [],
        notes: null,
        created_at: now,
        updated_at: now,
      },
      latest_sleep: {
        id: "sleep-1",
        user_id: "u1",
        sleep_date: "2026-05-21",
        bedtime_at: "2026-05-20T23:30:00+00:00",
        wake_at: "2026-05-21T07:00:00+00:00",
        time_in_bed_minutes: 480,
        duration_minutes: 450,
        sleep_latency_minutes: 16,
        awakenings_count: 1,
        awake_minutes: 10,
        restoration: 8,
        quality: 7,
        quality_score: 82,
        quality_breakdown: {
          duration: 100,
          routine: 72,
          duration_minutes: 450,
          midpoint_deviation_minutes: 42,
          target_duration_minutes: 480,
        },
        phases: {},
        factors: [],
        created_at: now,
        updated_at: now,
      },
      latest_activity: {
        id: "activity-1",
        user_id: "u1",
        activity_date: "2026-05-21",
        steps: 7400,
        active_minutes: 42,
        source: "manual",
        created_at: now,
        updated_at: now,
      },
      recent_workouts: [],
      nutrition_today: null,
      nutrition_summary: {
        logged_on: "2026-05-21",
        calories: 720,
        protein_g: 48,
        carbs_g: 82,
        fat_g: 18,
        fiber_g: 7,
        water_ml: 1200,
      },
      meals_today: [],
      biomarkers: [],
      medical_records_count: 0,
      insights: [
        {
          id: "sleep",
          severity: "info",
          title: "Сон в норме",
          message: "Последняя запись сна выглядит ровно.",
          suggested_action: "Сохрани режим.",
          used_data: ["health_sleep_logs"],
        },
      ],
      safety_note:
        "Подсказки по здоровью являются справочной поддержкой и не заменяют врача, диагностику или лечение.",
    });
    vi.mocked(listHealthSleepLogs).mockResolvedValue([]);
    vi.mocked(getActiveHealthSleepSession).mockResolvedValue(null);
    vi.mocked(getHealthSleepGoal).mockResolvedValue({
      user_id: "u1",
      target_duration_minutes: 480,
      target_bedtime: "23:30",
      target_wake_time: "07:30",
    });
    vi.mocked(getHealthSleepStats).mockResolvedValue({
      average_duration_minutes: 450,
      average_score: 82,
      average_midpoint_deviation_minutes: 42,
      good_sleep_streak: 2,
      target_duration_minutes: 480,
      nights_count: 1,
      series: [{ sleep_date: "2026-05-21", duration_minutes: 450, quality_score: 82, tone: "good" }],
      tips: [
        {
          id: "sleep-baseline",
          severity: "info",
          title: "Собираем базу сна",
          message: "После нескольких ночей приложение точнее покажет регулярность и тренды.",
          suggested_action: "Записывай время лег/встал.",
        },
      ],
    });
    vi.mocked(listHealthActivityLogs).mockResolvedValue([]);
    vi.mocked(listHealthWorkouts).mockResolvedValue([]);
    vi.mocked(getHealthNutritionDiary).mockResolvedValue({
      logged_on: "2026-05-21",
      meals: [],
      water_logs: [],
      summary: {
        logged_on: "2026-05-21",
        calories: 720,
        protein_g: 48,
        carbs_g: 82,
        fat_g: 18,
        fiber_g: 7,
        water_ml: 1200,
      },
    });

    renderHealth();

    expect(
      await screen.findByRole("heading", { name: "Здоровье" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("74")).toBeInTheDocument();
    expect(await screen.findByText("Сон в норме")).toBeInTheDocument();
    expect(screen.getByText("Настроить показатели")).toBeInTheDocument();
    expect(screen.queryByText("Сохранить ночь")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Сон.*открыть/s }));
    expect(screen.getByText("Иду спать")).toBeInTheDocument();
    expect(screen.getByText("Сохранить ночь")).toBeInTheDocument();
    expect(screen.getByText("Сохранить цель сна")).toBeInTheDocument();
    expect(screen.getByText("История сна")).toBeInTheDocument();
    expect(screen.queryByText("Засыпание, мин")).not.toBeInTheDocument();
    expect(screen.queryByText("Факторы через запятую")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("← Главная здоровья"));
    expect(screen.getByText("Разделы")).toBeInTheDocument();
    expect(screen.queryByText("Сохранить ночь")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Активность.*открыть/s }));
    expect(screen.getByText("шаги, минуты, калории и стояние из AI-ввода")).toBeInTheDocument();
    fireEvent.click(screen.getByText("← Главная здоровья"));
    expect(screen.getByText("Разделы")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Тренировки.*открыть/s }));
    expect(screen.getByText("Сохранить тренировку")).toBeInTheDocument();
    fireEvent.click(screen.getByText("← Главная здоровья"));
    expect(screen.getByText("Разделы")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Питание.*открыть/s }));
    expect(screen.getByText("Сохранить еду")).toBeInTheDocument();
    expect(screen.queryByText("Сохранить биомаркер")).not.toBeInTheDocument();
    expect(screen.queryByText("Сохранить медзапись")).not.toBeInTheDocument();
    expect(screen.queryByText("Сохранить состояние")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("← Главная здоровья"));
    expect(screen.getByText("Разделы")).toBeInTheDocument();

    await waitFor(() => {
      expect(getHealthNutritionDiary).toHaveBeenCalled();
    });
  });
});
