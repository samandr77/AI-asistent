import NetInfo from "@react-native-community/netinfo";
import { Sentry } from "./sentry";
import {
  dumpTextRaw,
  dumpVoiceRaw,
  DumpTextResponse,
  DumpVoiceResponse,
} from "./api";
import { useAppStore, PendingDump } from "../store/useAppStore";

const MAX_ATTEMPTS = 5;
let isDraining = false;

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export async function enqueueTextDump(
  text: string,
): Promise<DumpTextResponse | null> {
  const store = useAppStore.getState();
  if (await isOnline()) {
    try {
      return await dumpTextRaw(text);
    } catch (e) {
      Sentry.captureException(e, { tags: { area: "dumpQueue.text" } });
      store.enqueueDump({ kind: "text", text });
      void drainQueue();
      return null;
    }
  }
  store.enqueueDump({ kind: "text", text });
  return null;
}

export async function enqueueVoiceDump(
  uri: string,
): Promise<DumpVoiceResponse | null> {
  const store = useAppStore.getState();
  if (await isOnline()) {
    try {
      return await dumpVoiceRaw(uri);
    } catch (e) {
      Sentry.captureException(e, { tags: { area: "dumpQueue.voice" } });
      store.enqueueDump({ kind: "voice", uri });
      void drainQueue();
      return null;
    }
  }
  store.enqueueDump({ kind: "voice", uri });
  return null;
}

async function attempt(dump: PendingDump): Promise<boolean> {
  try {
    if (dump.kind === "text" && dump.text) {
      await dumpTextRaw(dump.text);
    } else if (dump.kind === "voice" && dump.uri) {
      await dumpVoiceRaw(dump.uri);
    } else {
      return true;
    }
    return true;
  } catch (e: any) {
    Sentry.captureException(e, {
      extra: { dumpId: dump.id, kind: dump.kind, attempts: dump.attempts + 1 },
    });
    useAppStore.getState().updateDump(dump.id, {
      attempts: dump.attempts + 1,
      lastError: e?.message ?? "unknown",
    });
    return false;
  }
}

export async function drainQueue(): Promise<void> {
  if (isDraining) return;
  isDraining = true;
  try {
    const snapshot = [...useAppStore.getState().pendingDumps];
    for (const dump of snapshot) {
      if (dump.attempts >= MAX_ATTEMPTS) continue;
      const ok = await attempt(dump);
      if (ok) {
        useAppStore.getState().removeDump(dump.id);
      }
    }
  } finally {
    isDraining = false;
  }
}

export function startQueueListener(): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drainQueue();
    }
  });
}
