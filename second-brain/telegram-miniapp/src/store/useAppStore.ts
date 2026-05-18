import { create } from "zustand";

import { storage } from "../services/storage";
import type { Goal, PendingTextDump, Reflection, Task } from "../types/api";

const pendingDumpsKey = "telegram-miniapp:pending-text-dumps";

interface AppState {
  todayTasks: Task[];
  allTasks: Task[];
  goals: Goal[];
  reflections: Reflection[];
  pendingTextDumps: PendingTextDump[];
  setTodayTasks: (tasks: Task[]) => void;
  setAllTasks: (tasks: Task[]) => void;
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoalInStore: (id: string, updates: Partial<Goal>) => void;
  removeGoalFromStore: (id: string) => void;
  setReflections: (reflections: Reflection[]) => void;
  addReflection: (reflection: Reflection) => void;
  updateReflectionInStore: (id: string, updates: Partial<Reflection>) => void;
  removeReflectionFromStore: (id: string) => void;
  updateTaskInStore: (id: string, updates: Partial<Task>) => void;
  removeTaskFromStore: (id: string) => void;
  enqueueTextDump: (text: string) => PendingTextDump;
  updatePendingTextDump: (id: string, updates: Partial<PendingTextDump>) => void;
  removePendingTextDump: (id: string) => void;
}

function readPendingTextDumps(): PendingTextDump[] {
  const raw = storage.getString(pendingDumpsKey);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writePendingTextDumps(dumps: PendingTextDump[]): void {
  storage.setString(pendingDumpsKey, JSON.stringify(dumps));
}

function createPendingTextDump(text: string): PendingTextDump {
  return {
    id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: "text",
    text,
    created_at: Date.now(),
    attempts: 0,
  };
}

export const useAppStore = create<AppState>((set) => ({
  todayTasks: [],
  allTasks: [],
  goals: [],
  reflections: [],
  pendingTextDumps: readPendingTextDumps(),
  setTodayTasks: (todayTasks) => set({ todayTasks }),
  setAllTasks: (allTasks) => set({ allTasks }),
  setGoals: (goals) => set({ goals }),
  addGoal: (goal) => set((state) => ({ goals: [goal, ...state.goals] })),
  updateGoalInStore: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === id ? { ...goal, ...updates } : goal,
      ),
    })),
  removeGoalFromStore: (id) =>
    set((state) => ({ goals: state.goals.filter((goal) => goal.id !== id) })),
  setReflections: (reflections) => set({ reflections }),
  addReflection: (reflection) =>
    set((state) => ({
      reflections: [
        reflection,
        ...state.reflections.filter((item) => item.id !== reflection.id),
      ],
    })),
  updateReflectionInStore: (id, updates) =>
    set((state) => ({
      reflections: state.reflections.map((reflection) =>
        reflection.id === id ? { ...reflection, ...updates } : reflection,
      ),
    })),
  removeReflectionFromStore: (id) =>
    set((state) => ({
      reflections: state.reflections.filter((reflection) => reflection.id !== id),
    })),
  updateTaskInStore: (id, updates) =>
    set((state) => ({
      todayTasks: state.todayTasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task,
      ),
      allTasks: state.allTasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task,
      ),
    })),
  removeTaskFromStore: (id) =>
    set((state) => ({
      todayTasks: state.todayTasks.filter((task) => task.id !== id),
      allTasks: state.allTasks.filter((task) => task.id !== id),
    })),
  enqueueTextDump: (text) => {
    const pendingDump = createPendingTextDump(text);
    set((state) => {
      const pendingTextDumps = [...state.pendingTextDumps, pendingDump];
      writePendingTextDumps(pendingTextDumps);
      return { pendingTextDumps };
    });
    return pendingDump;
  },
  updatePendingTextDump: (id, updates) =>
    set((state) => {
      const pendingTextDumps = state.pendingTextDumps.map((dump) =>
        dump.id === id ? { ...dump, ...updates } : dump,
      );
      writePendingTextDumps(pendingTextDumps);
      return { pendingTextDumps };
    }),
  removePendingTextDump: (id) =>
    set((state) => {
      const pendingTextDumps = state.pendingTextDumps.filter(
        (dump) => dump.id !== id,
      );
      writePendingTextDumps(pendingTextDumps);
      return { pendingTextDumps };
    }),
}));
