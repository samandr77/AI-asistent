import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodayScreen } from "../src/screens/today/TodayScreen";
import { getTodayTasks } from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    getTodayTasks: vi.fn(),
  };
});

const mockedGetTodayTasks = vi.mocked(getTodayTasks);

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TodayScreen", () => {
  beforeEach(() => {
    mockedGetTodayTasks.mockReset();
  });

  it("renders today's tasks returned by the API", async () => {
    mockedGetTodayTasks.mockResolvedValue([
      {
        id: "task-1",
        title: "Plan Telegram launch",
        sphere: "work",
        priority: 1,
        is_done: false,
        is_today: true,
      },
    ]);

    renderWithProviders();

    expect(await screen.findByText("Plan Telegram launch")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    mockedGetTodayTasks.mockResolvedValue([]);

    renderWithProviders();

    expect(await screen.findByText(/no tasks|задач нет/i)).toBeInTheDocument();
  });
});
