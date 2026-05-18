import { Sentry } from "./sentry";
import { dumpTextRaw } from "./api";
import { useAppStore } from "../store/useAppStore";
import type { DumpTextResponse, PendingTextDump } from "../types/api";

const maxAttempts = 5;
let isDraining = false;

function isOnline(): boolean {
  return navigator.onLine !== false;
}

export async function enqueueTextDump(
  text: string,
): Promise<DumpTextResponse | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (isOnline()) {
    try {
      return await dumpTextRaw(trimmed);
    } catch (error) {
      if ((error as { status?: number }).status === 402) {
        throw error;
      }
      Sentry.captureException(error, { tags: { area: "telegram.dumpQueue" } });
    }
  }

  useAppStore.getState().enqueueTextDump(trimmed);
  return null;
}

async function attempt(dump: PendingTextDump): Promise<boolean> {
  try {
    await dumpTextRaw(dump.text);
    return true;
  } catch (error) {
    Sentry.captureException(error, {
      extra: { dumpId: dump.id, attempts: dump.attempts + 1 },
      tags: { area: "telegram.dumpQueue.drain" },
    });
    useAppStore.getState().updatePendingTextDump(dump.id, {
      attempts: dump.attempts + 1,
      last_error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function drainTextDumpQueue(): Promise<void> {
  if (isDraining || !isOnline()) return;
  isDraining = true;
  try {
    const snapshot = [...useAppStore.getState().pendingTextDumps];
    for (const dump of snapshot) {
      if (dump.attempts >= maxAttempts) continue;
      const succeeded = await attempt(dump);
      if (succeeded) {
        useAppStore.getState().removePendingTextDump(dump.id);
      }
    }
  } finally {
    isDraining = false;
  }
}

export function startTextDumpQueueListener(): () => void {
  const onOnline = () => {
    void drainTextDumpQueue();
  };
  window.addEventListener("online", onOnline);
  void drainTextDumpQueue();
  return () => window.removeEventListener("online", onOnline);
}
