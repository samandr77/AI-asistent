import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDetailScreen } from "../src/screens/tasks/TaskDetailScreen";
import { TasksScreen } from "../src/screens/tasks/TasksScreen";
import { deleteTask, getAllTasks, updateTask } from "../src/services/api";
import type { Task } from "../src/types/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    deleteTask: vi.fn(),
    getAllTasks: vi.fn(),
    updateTask: vi.fn(),
  };
});

const task: Task = {
  id: "task-1",
  title: "Ship task screen",
  sphere: "work",
  priority: 2,
  is_done: false,
  is_today: true,
  notes: "Important",
  status: "active",
};

const mockedDeleteTask = vi.mocked(deleteTask);
const mockedGetAllTasks = vi.mocked(getAllTasks);
const mockedUpdateTask = vi.mocked(updateTask);

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("Task screens", () => {
  beforeEach(() => {
    mockedDeleteTask.mockReset();
    mockedGetAllTasks.mockReset();
    mockedUpdateTask.mockReset();
  });

  it("renders tasks and applies sphere filter", async () => {
    mockedGetAllTasks.mockResolvedValue([task]);

    render(
      <QueryClientProvider client={queryClient()}>
        <MemoryRouter>
          <TasksScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Ship task screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /work|работа/i }));
    await waitFor(() => {
      expect(mockedGetAllTasks).toHaveBeenLastCalledWith({ sphere: "work" });
    });
  });

  it("edits, marks done, and deletes a task from detail", async () => {
    mockedUpdateTask.mockImplementation(async (_id, updates) => ({
      ...task,
      ...updates,
    }));
    mockedDeleteTask.mockResolvedValue();

    render(
      <QueryClientProvider client={queryClient()}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/tasks/task-1",
              state: { task },
            },
          ]}
        >
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskDetailScreen />} />
            <Route path="/tasks" element={<div>Tasks route</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/title|название/i), {
      target: { value: "Updated task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save|сохранить/i }));
    await waitFor(() => {
      expect(mockedUpdateTask).toHaveBeenCalledWith("task-1", {
        title: "Updated task",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /done|готово/i }));
    await waitFor(() => {
      expect(mockedUpdateTask).toHaveBeenCalledWith("task-1", {
        is_done: true,
      });
    });

    render(
      <QueryClientProvider client={queryClient()}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/tasks/task-1",
              state: { task },
            },
          ]}
        >
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskDetailScreen />} />
            <Route path="/tasks" element={<div>Tasks route</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete|удалить/i }));
    await waitFor(() => {
      expect(mockedDeleteTask).toHaveBeenCalledWith("task-1");
    });
  });
});
