import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TasksScreen } from "../src/screens/tasks/TasksScreen";
import { createTask, getAllTasks, getInboxTasks } from "../src/services/api";
import type { Task } from "../src/types/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    getAllTasks: vi.fn(),
    getInboxTasks: vi.fn(),
    createTask: vi.fn(),
  };
});

const mockedGetAllTasks = vi.mocked(getAllTasks);
const mockedGetInbox = vi.mocked(getInboxTasks);
const mockedCreateTask = vi.mocked(createTask);

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderScreen() {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <TasksScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Quick capture on TasksScreen", () => {
  beforeEach(() => {
    mockedGetAllTasks.mockResolvedValue([]);
    mockedGetInbox.mockResolvedValue([]);
    mockedCreateTask.mockReset();
  });

  it("does not call createTask for empty input", async () => {
    renderScreen();
    const submit = await screen.findByRole("button", { name: /Добавить/ });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(mockedCreateTask).not.toHaveBeenCalled();
  });

  it("submits trimmed text to createTask and clears the input on success", async () => {
    const created: Task = {
      id: "new-1",
      title: "купить хлеб",
      sphere: "work",
      priority: 2,
      is_done: false,
      is_today: false,
      status: "inbox",
      raw_text: "купить хлеб",
    };
    mockedCreateTask.mockResolvedValue(created);

    renderScreen();
    const input = await screen.findByPlaceholderText(
      /Запишите задачу одной строкой/,
    );
    fireEvent.change(input, { target: { value: "  купить хлеб  " } });
    const submit = screen.getByRole("button", { name: /Добавить/ });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockedCreateTask).toHaveBeenCalledWith({
        title: "купить хлеб",
        raw_text: "купить хлеб",
        status: "inbox",
      });
    });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("");
    });
  });

  it("keeps the input value and shows error when createTask fails", async () => {
    mockedCreateTask.mockRejectedValue(new Error("network"));

    renderScreen();
    const input = await screen.findByPlaceholderText(
      /Запишите задачу одной строкой/,
    );
    fireEvent.change(input, { target: { value: "тестовая задача" } });
    fireEvent.click(screen.getByRole("button", { name: /Добавить/ }));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось создать задачу/)).toBeInTheDocument();
    });
    expect((input as HTMLInputElement).value).toBe("тестовая задача");
  });
});
