import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoalsScreen } from "../src/screens/goals/GoalsScreen";
import { NewGoalScreen } from "../src/screens/goals/NewGoalScreen";
import { createGoal, listGoals } from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    createGoal: vi.fn(),
    listGoals: vi.fn(),
  };
});

const mockedCreateGoal = vi.mocked(createGoal);
const mockedListGoals = vi.mocked(listGoals);

function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Goals screens", () => {
  beforeEach(() => {
    mockedCreateGoal.mockReset();
    mockedListGoals.mockReset();
  });

  it("renders goals returned by the API", async () => {
    mockedListGoals.mockResolvedValue([
      {
        id: "goal-1",
        user_id: "user-1",
        title: "Launch Telegram app",
        status: "active",
        progress_percent: 30,
        created_at: "2026-05-02T00:00:00Z",
        updated_at: "2026-05-02T00:00:00Z",
      },
    ]);

    renderWithProviders(<GoalsScreen />);

    expect(await screen.findByText("Launch Telegram app")).toBeInTheDocument();
  });

  it("validates and creates a goal", async () => {
    mockedCreateGoal.mockResolvedValue({
      id: "goal-1",
      user_id: "user-1",
      title: "Launch Telegram app",
      status: "active",
      progress_percent: 0,
      created_at: "2026-05-02T00:00:00Z",
      updated_at: "2026-05-02T00:00:00Z",
    });

    renderWithProviders(<NewGoalScreen />);

    fireEvent.click(screen.getByRole("button", { name: /create|создать/i }));
    expect(screen.getByText(/required|обязательно/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/title|название/i), {
      target: { value: "Launch Telegram app" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create|создать/i }));

    await waitFor(() => {
      expect(mockedCreateGoal.mock.calls[0]?.[0]).toMatchObject({
        title: "Launch Telegram app",
      });
    });
  });

  it("routes active-goal limit errors to Premium", async () => {
    mockedCreateGoal.mockRejectedValue({ status: 402 });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/goals/new"]}>
          <Routes>
            <Route path="/goals/new" element={<NewGoalScreen />} />
            <Route path="/premium" element={<div>Premium route</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/title|название/i), {
      target: { value: "One more goal" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create|создать/i }));

    expect(await screen.findByText("Premium route")).toBeInTheDocument();
  });
});
