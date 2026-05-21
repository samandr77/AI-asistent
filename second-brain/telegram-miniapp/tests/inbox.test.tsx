import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxScreen } from "../src/screens/tasks/InboxScreen";
import { getInboxTasks, processTask } from "../src/services/api";
import type { Task } from "../src/types/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    getInboxTasks: vi.fn(),
    processTask: vi.fn(),
  };
});

const mockedGetInbox = vi.mocked(getInboxTasks);
const mockedProcess = vi.mocked(processTask);

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderInbox() {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <InboxScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const inboxTask: Task = {
  id: "inbox-1",
  title: "позвонить Маше",
  sphere: "work",
  priority: 2,
  is_done: false,
  is_today: false,
  status: "inbox",
  raw_text: "позвонить Маше завтра",
};

describe("InboxScreen", () => {
  beforeEach(() => {
    mockedGetInbox.mockReset();
    mockedProcess.mockReset();
  });

  it("shows empty state when inbox is empty", async () => {
    mockedGetInbox.mockResolvedValue([]);
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText(/Инбокс пуст/)).toBeInTheDocument();
    });
  });

  it("renders inbox cards with raw_text", async () => {
    mockedGetInbox.mockResolvedValue([inboxTask]);
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText("позвонить Маше")).toBeInTheDocument();
    });
    expect(screen.getByText(/позвонить Маше завтра/)).toBeInTheDocument();
  });

  it("calls processTask with schedule today on button click", async () => {
    mockedGetInbox.mockResolvedValue([inboxTask]);
    mockedProcess.mockResolvedValue({
      task: { ...inboxTask, status: "active", is_today: true },
      already_processed: false,
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText("позвонить Маше")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /На сегодня/ }));
    await waitFor(() => {
      expect(mockedProcess).toHaveBeenCalledWith("inbox-1", {
        action: "schedule",
        is_today: true,
      });
    });
  });

  it("shows already-processed notice when API returns already_processed=true", async () => {
    mockedGetInbox.mockResolvedValue([inboxTask]);
    mockedProcess.mockResolvedValue({
      task: { ...inboxTask, status: "active" },
      already_processed: true,
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText("позвонить Маше")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /На сегодня/ }));
    await waitFor(() => {
      expect(screen.getByText(/Задача уже обработана/)).toBeInTheDocument();
    });
  });
});
