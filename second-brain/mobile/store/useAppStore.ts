import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { Sphere } from "../constants/spheres";

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
}

export interface UserProfile {
  id: string;
  name?: string;
  language?: string;
  role?: string;
  living_with?: string;
  peak_hours?: string;
}

interface AppState {
  user: UserProfile | null;
  todayTasks: Task[];
  allTasks: Task[];
  isOnboarded: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setTodayTasks: (tasks: Task[]) => void;
  setAllTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  setLoading: (v: boolean) => void;
}

const mmkv = createMMKV({ id: "app-store" });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      todayTasks: [],
      allTasks: [],
      isOnboarded: false,
      isLoading: false,
      setUser: (user) => set({ user }),
      setTodayTasks: (todayTasks) => set({ todayTasks }),
      setAllTasks: (allTasks) => set({ allTasks }),
      updateTask: (id, updates) =>
        set((s) => ({
          todayTasks: s.todayTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
          allTasks: s.allTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({
          todayTasks: s.todayTasks.filter((t) => t.id !== id),
          allTasks: s.allTasks.filter((t) => t.id !== id),
        })),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "app-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isOnboarded: state.isOnboarded,
      }),
    },
  ),
);
