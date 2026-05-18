import { beforeEach, describe, expect, it, vi } from "vitest";

import { dumpTextRaw } from "../src/services/api";
import { drainTextDumpQueue, enqueueTextDump } from "../src/services/dumpQueue";
import { useAppStore } from "../src/store/useAppStore";

vi.mock("../src/services/api", () => ({
  dumpTextRaw: vi.fn(),
}));

const mockedDumpTextRaw = vi.mocked(dumpTextRaw);

describe("dumpQueue", () => {
  beforeEach(() => {
    mockedDumpTextRaw.mockReset();
    useAppStore.setState({ pendingTextDumps: [] });
  });

  it("sends immediately when online", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    mockedDumpTextRaw.mockResolvedValue({
      dump_id: "dump-1",
      tasks: [],
      today_top3: [],
      task_ids: [],
    });

    const result = await enqueueTextDump("ship it");

    expect(result?.dump_id).toBe("dump-1");
    expect(useAppStore.getState().pendingTextDumps).toHaveLength(0);
  });

  it("persists text when offline and drains later", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    const queued = await enqueueTextDump("offline thought");

    expect(queued).toBeNull();
    expect(useAppStore.getState().pendingTextDumps).toHaveLength(1);

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    mockedDumpTextRaw.mockResolvedValue({
      dump_id: "dump-2",
      tasks: [],
      today_top3: [],
      task_ids: [],
    });

    await drainTextDumpQueue();

    expect(mockedDumpTextRaw).toHaveBeenCalledWith("offline thought");
    expect(useAppStore.getState().pendingTextDumps).toHaveLength(0);
  });
});
