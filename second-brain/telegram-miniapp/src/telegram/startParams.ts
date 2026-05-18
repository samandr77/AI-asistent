export type TelegramStartParam =
  | { kind: "empty" }
  | { kind: "dump_result"; dumpId: string }
  | { kind: "task"; taskId: string }
  | { kind: "goal"; goalId: string }
  | { kind: "reflection"; date: string }
  | { kind: "premium" }
  | { kind: "settings" }
  | { kind: "unknown"; raw: string };

export function parseTelegramStartParam(
  raw: string | null | undefined,
): TelegramStartParam {
  if (!raw) return { kind: "empty" };

  const [kind, value] = raw.split(":", 2);

  if (kind === "dump" && value) {
    return { kind: "dump_result", dumpId: value };
  }
  if (kind === "task" && value) {
    return { kind: "task", taskId: value };
  }
  if (kind === "goal" && value) {
    return { kind: "goal", goalId: value };
  }
  if (kind === "reflection" && value) {
    return { kind: "reflection", date: value };
  }
  if (raw === "premium") {
    return { kind: "premium" };
  }
  if (raw === "settings") {
    return { kind: "settings" };
  }

  return { kind: "unknown", raw };
}
