import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DumpScreen } from "../src/screens/dump/DumpScreen";
import { enqueueTextDump } from "../src/services/dumpQueue";

vi.mock("../src/services/dumpQueue", async () => {
  const actual = await vi.importActual<typeof import("../src/services/dumpQueue")>(
    "../src/services/dumpQueue",
  );
  return {
    ...actual,
    enqueueTextDump: vi.fn(),
  };
});

const mockedEnqueueTextDump = vi.mocked(enqueueTextDump);

describe("DumpScreen", () => {
  beforeEach(() => {
    mockedEnqueueTextDump.mockReset();
  });

  it("submits a text dump", async () => {
    mockedEnqueueTextDump.mockResolvedValue({
      dump_id: "dump-1",
      tasks: [],
      today_top3: [],
      task_ids: [],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DumpScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText(/mind|голове/i), {
      target: { value: "Plan the launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /parse|разобрать/i }));

    await waitFor(() => {
      expect(mockedEnqueueTextDump.mock.calls[0]?.[0]).toBe("Plan the launch");
    });
  });
});
