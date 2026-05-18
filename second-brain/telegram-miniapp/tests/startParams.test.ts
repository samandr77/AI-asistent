import { describe, expect, it } from "vitest";

import { parseTelegramStartParam } from "../src/telegram/startParams";

describe("parseTelegramStartParam", () => {
  it("returns empty for missing values", () => {
    expect(parseTelegramStartParam(null)).toEqual({ kind: "empty" });
  });

  it("parses entity deep links", () => {
    expect(parseTelegramStartParam("dump:abc")).toEqual({
      kind: "dump_result",
      dumpId: "abc",
    });
    expect(parseTelegramStartParam("task:t1")).toEqual({
      kind: "task",
      taskId: "t1",
    });
    expect(parseTelegramStartParam("goal:g1")).toEqual({
      kind: "goal",
      goalId: "g1",
    });
    expect(parseTelegramStartParam("reflection:2026-05-02")).toEqual({
      kind: "reflection",
      date: "2026-05-02",
    });
  });

  it("parses static destinations", () => {
    expect(parseTelegramStartParam("premium")).toEqual({ kind: "premium" });
    expect(parseTelegramStartParam("settings")).toEqual({ kind: "settings" });
  });

  it("keeps unknown values for diagnostics", () => {
    expect(parseTelegramStartParam("surprise")).toEqual({
      kind: "unknown",
      raw: "surprise",
    });
  });
});
