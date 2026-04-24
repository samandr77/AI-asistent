import { Platform } from "react-native";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Sphere } from "../constants/spheres";
import { createSyncStorage } from "../services/platformStorage";

export interface Task {
  id: string;
  title: string;
  sphere: Sphere;
  priority: 1 | 2 | 3;
  is_done: boolean;
  is_today: boolean;
  deadline?: string | null;
  reminder_at?: string | null;
  notes?: string | null;
  goal_id?: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: "active" | "paused" | "achieved" | "archived";
  sphere?: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  energy: number;
  notes: string | null;
  completed_count: number;
  goal_aligned_count: number;
  active_goal_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ReflectionStats {
  current_streak: number;
  longest_streak: number;
  total_reflections: number;
}

export interface PremiumStatus {
  is_premium: boolean;
  entitlement_id: string | null;
  expires_at: string | null;
  period_type: string | null;
  store: string | null;
  cancelled: boolean;
}

export interface PendingDump {
  id: string;
  kind: "text" | "voice";
  text?: string;
  uri?: string;
  createdAt: number;
  lastError?: string;
  attempts: number;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  language?: string;
  role?: string;
  living_with?: string;
  peak_hours?: string;
  is_onboarded?: boolean;
}

interface AppState {
  user: UserProfile | null;
  todayTasks: Task[];
  allTasks: Task[];
  goals: Goal[];
  isOnboarded: boolean;
  isLoading: boolean;
  goalsLoading: boolean;
  reflections: Reflection[];
  reflectionStats: ReflectionStats | null;
  reflectionReminderTime: string | null;
  reflectionsLoading: boolean;
  premium: PremiumStatus;
  pendingDumps: PendingDump[];
  enqueueDump: (
    dump: Omit<PendingDump, "id" | "createdAt" | "attempts">,
  ) => string;
  updateDump: (id: string, updates: Partial<PendingDump>) => void;
  removeDump: (id: string) => void;
  setUser: (user: UserProfile | null) => void;
  setTodayTasks: (tasks: Task[]) => void;
  setAllTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  setGoalsLoading: (v: boolean) => void;
  setReflections: (reflections: Reflection[]) => void;
  addReflection: (reflection: Reflection) => void;
  updateReflectionInStore: (id: string, updates: Partial<Reflection>) => void;
  setReflectionStats: (stats: ReflectionStats | null) => void;
  setReflectionReminderTime: (time: string | null) => void;
  setReflectionsLoading: (v: boolean) => void;
  setPremium: (status: PremiumStatus) => void;
}

const localStorageBackend = createSyncStorage(
  Platform.OS === "web" ? "app-store-web" : "app-store",
);

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      todayTasks: [],
      allTasks: [],
      goals: [],
      isOnboarded: false,
      isLoading: false,
      goalsLoading: false,
      reflections: [],
      reflectionStats: null,
      reflectionReminderTime: "21:00",
      reflectionsLoading: false,
      premium: {
        is_premium: false,
        entitlement_id: null,
        expires_at: null,
        period_type: null,
        store: null,
        cancelled: false,
      },
      pendingDumps: [],
      enqueueDump: (d) => {
        const id = `dump_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({
          pendingDumps: [
            ...s.pendingDumps,
            { ...d, id, createdAt: Date.now(), attempts: 0 },
          ],
        }));
        return id;
      },
      updateDump: (id, updates) =>
        set((s) => ({
          pendingDumps: s.pendingDumps.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),
      removeDump: (id) =>
        set((s) => ({
          pendingDumps: s.pendingDumps.filter((p) => p.id !== id),
        })),
      setUser: (user) => set({ user }),
      setTodayTasks: (todayTasks) => set({ todayTasks }),
      setAllTasks: (allTasks) => set({ allTasks }),
      updateTask: (id, updates) =>
        set((s) => {
          const updatedAllTasks = s.allTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          );
          const updatedTask = updatedAllTasks.find((t) => t.id === id);

          let updatedTodayTasks = s.todayTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          );
          if (updatedTask) {
            if (updates.is_today === false) {
              updatedTodayTasks = updatedTodayTasks.filter((t) => t.id !== id);
            } else if (
              updates.is_today === true &&
              !s.todayTasks.find((t) => t.id === id)
            ) {
              updatedTodayTasks = [...updatedTodayTasks, updatedTask];
            }
          }

          return { todayTasks: updatedTodayTasks, allTasks: updatedAllTasks };
        }),
      deleteTask: (id) =>
        set((s) => ({
          todayTasks: s.todayTasks.filter((t) => t.id !== id),
          allTasks: s.allTasks.filter((t) => t.id !== id),
        })),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setLoading: (isLoading) => set({ isLoading }),
      setGoals: (goals) => set({ goals }),
      addGoal: (goal) => set((s) => ({ goals: [goal, ...s.goals] })),
      updateGoal: (id, updates) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      setGoalsLoading: (goalsLoading) => set({ goalsLoading }),
      setReflections: (reflections) => set({ reflections }),
      addReflection: (reflection) =>
        set((s) => {
          const filtered = s.reflections.filter((r) => r.id !== reflection.id);
          return { reflections: [reflection, ...filtered].slice(0, 30) };
        }),
      updateReflectionInStore: (id, updates) =>
        set((s) => ({
          reflections: s.reflections.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        })),
      setReflectionStats: (reflectionStats) => set({ reflectionStats }),
      setReflectionReminderTime: (reflectionReminderTime) =>
        set({ reflectionReminderTime }),
      setReflectionsLoading: (reflectionsLoading) =>
        set({ reflectionsLoading }),
      setPremium: (premium) => set({ premium }),
    }),
    {
      name: "app-store",
      storage: createJSONStorage(() => localStorageBackend),
      partialize: (state) => ({
        user: state.user,
        isOnboarded: state.isOnboarded,
        goals: state.goals,
        reflections: state.reflections,
        reflectionReminderTime: state.reflectionReminderTime,
        premium: state.premium,
        pendingDumps: state.pendingDumps,
      }),
    },
  ),
);
