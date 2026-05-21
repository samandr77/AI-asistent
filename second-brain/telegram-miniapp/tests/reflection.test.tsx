import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReflectionListScreen } from "../src/screens/reflection/ReflectionListScreen";
import { ReflectionSettingsScreen } from "../src/screens/reflection/ReflectionSettingsScreen";
import { TodayReflectionScreen } from "../src/screens/reflection/TodayReflectionScreen";
import {
  createReflection,
  getReflectionStats,
  getTelegramReminderSettings,
  getTodaySummary,
  listReflections,
  saveTelegramReminderSettings,
} from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    createReflection: vi.fn(),
    getReflectionStats: vi.fn(),
    getTelegramReminderSettings: vi.fn(),
    getTodaySummary: vi.fn(),
    listReflections: vi.fn(),
    saveTelegramReminderSettings: vi.fn(),
  };
});

const mockedCreateReflection = vi.mocked(createReflection);
const mockedGetReflectionStats = vi.mocked(getReflectionStats);
const mockedGetTelegramReminderSettings = vi.mocked(getTelegramReminderSettings);
const mockedGetTodaySummary = vi.mocked(getTodaySummary);
const mockedListReflections = vi.mocked(listReflections);
const mockedSaveTelegramReminderSettings = vi.mocked(saveTelegramReminderSettings);

const reflection = {
  id: "reflection-1",
  user_id: "user-1",
  date: "2026-05-02",
  mood: 4,
  energy: 3,
  notes: "Good progress",
  completed_count: 3,
  goal_aligned_count: 2,
  active_goal_ids: ["goal-1"],
  created_at: "2026-05-02T21:00:00Z",
  updated_at: "2026-05-02T21:00:00Z",
};

function localDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderWithProviders(element: ReactElement, initialEntries = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Reflection screens", () => {
  beforeEach(() => {
    mockedCreateReflection.mockReset();
    mockedGetReflectionStats.mockReset();
    mockedGetTelegramReminderSettings.mockReset();
    mockedGetTodaySummary.mockReset();
    mockedListReflections.mockReset();
    mockedSaveTelegramReminderSettings.mockReset();
  });

  it("renders reflection history and streak stats", async () => {
    mockedListReflections.mockResolvedValue([reflection]);
    mockedGetReflectionStats.mockResolvedValue({
      current_streak: 3,
      longest_streak: 5,
      total_reflections: 8,
    });

    renderWithProviders(<ReflectionListScreen />);

    expect(await screen.findByText("2026-05-02")).toBeInTheDocument();
    expect(screen.getByText(/Серия: 3, всего: 8/i)).toBeInTheDocument();
  });

  it("shows a working yesterday backfill banner when the streak needs it", async () => {
    const yesterday = localDateOffset(-1);
    mockedListReflections.mockResolvedValue([
      { ...reflection, id: "reflection-old", date: localDateOffset(-3) },
    ]);
    mockedGetReflectionStats.mockResolvedValue({
      current_streak: 1,
      longest_streak: 5,
      total_reflections: 8,
    });

    renderWithProviders(<ReflectionListScreen />);

    const banner = await screen.findByText(/add yesterday|добавить вчера/i);
    expect(banner.closest("a")).toHaveAttribute(
      "href",
      `/reflections/today?date=${yesterday}`,
    );
  });

  it("saves today's reflection from the summary screen", async () => {
    mockedGetTodaySummary.mockResolvedValue({
      date: "2026-05-02",
      completed_tasks: [],
      goal_aligned_tasks: [],
      goals_with_progress: [],
      total_dumps: 1,
      existing_reflection: null,
    });
    mockedCreateReflection.mockResolvedValue(reflection);

    renderWithProviders(<TodayReflectionScreen />);

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Wrapped up launch prep" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save|сохранить/i }));

    await waitFor(() => {
      expect(mockedCreateReflection.mock.calls[0]?.[0]).toMatchObject({
        mood: 3,
        energy: 3,
        notes: "Wrapped up launch prep",
      });
    });
  });

  it("saves a backfilled reflection for the requested date", async () => {
    mockedGetTodaySummary.mockResolvedValue({
      date: "2026-05-01",
      completed_tasks: [],
      goal_aligned_tasks: [],
      goals_with_progress: [],
      total_dumps: 0,
      existing_reflection: null,
    });
    mockedCreateReflection.mockResolvedValue({
      ...reflection,
      id: "reflection-yesterday",
      date: "2026-05-01",
    });

    renderWithProviders(<TodayReflectionScreen />, [
      "/reflections/today?date=2026-05-01",
    ]);

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Yesterday still matters" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save|сохранить/i }));

    await waitFor(() => {
      expect(mockedGetTodaySummary).toHaveBeenCalledWith({
        tzOffset: expect.any(Number),
        date: "2026-05-01",
      });
      expect(mockedCreateReflection.mock.calls[0]?.[0]).toMatchObject({
        date: "2026-05-01",
        notes: "Yesterday still matters",
      });
    });
  });

  it("validates and saves Telegram reminder settings", async () => {
    mockedGetTelegramReminderSettings.mockResolvedValue({
      daily_reflection_enabled: true,
      daily_reflection_time: "19:15",
      morning_enabled: false,
      morning_time: "09:00",
      timezone: null,
    });
    mockedSaveTelegramReminderSettings.mockResolvedValue({
      daily_reflection_enabled: true,
      daily_reflection_time: "20:45",
      morning_enabled: false,
      morning_time: "09:00",
      timezone: "UTC",
    });

    renderWithProviders(<ReflectionSettingsScreen />);

    const timeInput = await screen.findByLabelText(/time|время/i);
    await waitFor(() => {
      expect(timeInput).toHaveValue("19:15");
    });

    fireEvent.change(timeInput, {
      target: { value: "99:99" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save|сохранить/i })).toBeDisabled();
    });

    fireEvent.change(timeInput, {
      target: { value: "20:45" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save|сохранить/i }));

    await waitFor(() => {
      expect(mockedSaveTelegramReminderSettings.mock.calls[0]?.[0]).toMatchObject({
        daily_reflection_enabled: true,
        daily_reflection_time: "20:45",
      });
    });
  });
});
