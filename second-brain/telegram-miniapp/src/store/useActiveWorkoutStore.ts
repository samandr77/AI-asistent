import { create } from "zustand";

import { storage } from "../services/storage";
import type { SportKind } from "../types/api";

const STORAGE_KEY = "telegram-miniapp:active-workout";

export interface RestTimerState {
  startedAt: number;
  durationSec: number;
  setId: string | null;
}

interface ActiveWorkoutState {
  sessionId: string | null;
  sportKind: SportKind | null;
  startedAt: number | null;
  restTimer: RestTimerState | null;
  autoRestEnabled: boolean;
  start: (params: {
    sessionId: string;
    sportKind: SportKind | null;
    startedAt?: number;
  }) => void;
  stop: () => void;
  startRestTimer: (durationSec: number, setId: string | null) => void;
  clearRestTimer: () => void;
  setAutoRest: (enabled: boolean) => void;
}

interface PersistedShape {
  sessionId: string | null;
  sportKind: SportKind | null;
  startedAt: number | null;
  restTimer: RestTimerState | null;
  autoRestEnabled: boolean;
}

function loadFromStorage(): PersistedShape {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) {
    return {
      sessionId: null,
      sportKind: null,
      startedAt: null,
      restTimer: null,
      autoRestEnabled: true,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return {
      sessionId: parsed.sessionId ?? null,
      sportKind: parsed.sportKind ?? null,
      startedAt: parsed.startedAt ?? null,
      restTimer: parsed.restTimer ?? null,
      autoRestEnabled: parsed.autoRestEnabled ?? true,
    };
  } catch {
    return {
      sessionId: null,
      sportKind: null,
      startedAt: null,
      restTimer: null,
      autoRestEnabled: true,
    };
  }
}

function persist(state: PersistedShape): void {
  storage.setString(STORAGE_KEY, JSON.stringify(state));
}

const initial = loadFromStorage();

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  sessionId: initial.sessionId,
  sportKind: initial.sportKind,
  startedAt: initial.startedAt,
  restTimer: initial.restTimer,
  autoRestEnabled: initial.autoRestEnabled,

  start: ({ sessionId, sportKind, startedAt }) => {
    const next: PersistedShape = {
      sessionId,
      sportKind,
      startedAt: startedAt ?? Date.now(),
      restTimer: null,
      autoRestEnabled: get().autoRestEnabled,
    };
    persist(next);
    set(next);
  },

  stop: () => {
    const next: PersistedShape = {
      sessionId: null,
      sportKind: null,
      startedAt: null,
      restTimer: null,
      autoRestEnabled: get().autoRestEnabled,
    };
    persist(next);
    set(next);
  },

  startRestTimer: (durationSec, setId) => {
    const current = get();
    const restTimer: RestTimerState = {
      startedAt: Date.now(),
      durationSec,
      setId,
    };
    const next: PersistedShape = {
      sessionId: current.sessionId,
      sportKind: current.sportKind,
      startedAt: current.startedAt,
      restTimer,
      autoRestEnabled: current.autoRestEnabled,
    };
    persist(next);
    set({ restTimer });
  },

  clearRestTimer: () => {
    const current = get();
    const next: PersistedShape = {
      sessionId: current.sessionId,
      sportKind: current.sportKind,
      startedAt: current.startedAt,
      restTimer: null,
      autoRestEnabled: current.autoRestEnabled,
    };
    persist(next);
    set({ restTimer: null });
  },

  setAutoRest: (autoRestEnabled) => {
    const current = get();
    const next: PersistedShape = {
      sessionId: current.sessionId,
      sportKind: current.sportKind,
      startedAt: current.startedAt,
      restTimer: current.restTimer,
      autoRestEnabled,
    };
    persist(next);
    set({ autoRestEnabled });
  },
}));

export function restTimerRemaining(timer: RestTimerState | null): number {
  if (!timer) return 0;
  const elapsedSec = Math.floor((Date.now() - timer.startedAt) / 1000);
  return Math.max(0, timer.durationSec - elapsedSec);
}
