import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { WorkoutsScreen } from "../src/screens/health/WorkoutsScreen";
import {
  getActiveWorkoutSession,
  listWorkoutSessions,
} from "../src/services/api";
import type { WorkoutSession } from "../src/types/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    getActiveWorkoutSession: vi.fn(),
    listWorkoutSessions: vi.fn(),
  };
});

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "s-1",
    user_id: "u-1",
    session_type: "strength",
    sport_kind: null,
    title: "Push day",
    location: null,
    occurred_on: "2026-05-22",
    started_at: null,
    ended_at: null,
    duration_minutes: 60,
    rpe: 7,
    mood_before: null,
    mood_after: null,
    energy_before: null,
    energy_after: null,
    training_load_score: 420,
    intensity_minutes: null,
    calories: null,
    program_session_id: null,
    program_id: null,
    goal_id: null,
    source: "manual",
    raw_text: null,
    weather_conditions: null,
    is_completed: true,
    is_planned: false,
    planned_for: null,
    notes: null,
    distance_km: null,
    avg_pace_per_km_seconds: null,
    elevation_gain_m: null,
    max_speed_kmh: null,
    vertical_descent_m: null,
    cadence_avg: null,
    stroke_rate: null,
    swolf: null,
    pool_length_m: null,
    laps: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/health/workouts"]}>
        <WorkoutsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkoutsScreen", () => {
  it("renders empty state when there are no sessions", async () => {
    vi.mocked(getActiveWorkoutSession).mockResolvedValue(null);
    vi.mocked(listWorkoutSessions).mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Тренировок пока нет")).toBeInTheDocument();
    });
  });

  it("lists workout sessions when API returns rows", async () => {
    vi.mocked(getActiveWorkoutSession).mockResolvedValue(null);
    vi.mocked(listWorkoutSessions).mockResolvedValue([
      makeSession({ id: "s-1", title: "Push day", sport_kind: null }),
      makeSession({
        id: "s-2",
        title: "Утренний бег",
        sport_kind: "running",
        duration_minutes: 32,
        distance_km: 5.2,
      }),
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Push day")).toBeInTheDocument();
      expect(screen.getByText("Утренний бег")).toBeInTheDocument();
    });
  });

  it("shows active-session banner when an in-progress session exists", async () => {
    vi.mocked(getActiveWorkoutSession).mockResolvedValue(
      makeSession({
        id: "s-active",
        title: "Pull day",
        is_completed: false,
        started_at: "2026-05-22T10:00:00+00:00",
      }),
    );
    vi.mocked(listWorkoutSessions).mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Идёт тренировка")).toBeInTheDocument();
      expect(screen.getByText("Pull day")).toBeInTheDocument();
    });
  });
});
