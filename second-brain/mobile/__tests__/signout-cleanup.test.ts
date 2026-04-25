import { useAppStore } from "../store/useAppStore";

describe("resetAll() clears every authenticated slice", () => {
  beforeEach(() => {
    // Seed store with realistic signed-in state before each test.
    const s = useAppStore.getState();
    s.setUser({ id: "u-A", name: "Alice" });
    s.setOnboarded(true);
    s.setTodayTasks([
      {
        id: "t1",
        title: "x",
        sphere: "work" as any,
        priority: 2,
        is_done: false,
        is_today: true,
      },
    ]);
    s.setAllTasks([
      {
        id: "t1",
        title: "x",
        sphere: "work" as any,
        priority: 2,
        is_done: false,
        is_today: true,
      },
    ]);
    s.setGoals([
      {
        id: "g1",
        user_id: "u-A",
        title: "Goal",
        status: "active",
        progress_percent: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    s.setReflections([
      {
        id: "r1",
        user_id: "u-A",
        date: "2026-04-24",
        mood: 4,
        energy: 4,
        notes: null,
        completed_count: 1,
        goal_aligned_count: 0,
        active_goal_ids: [],
        created_at: "2026-04-24T20:00:00Z",
        updated_at: "2026-04-24T20:00:00Z",
      },
    ]);
    s.setReflectionStats({
      current_streak: 5,
      longest_streak: 5,
      total_reflections: 5,
    });
    s.setPremium({
      is_premium: true,
      entitlement_id: "premium",
      expires_at: "2099-01-01",
      period_type: "normal",
      store: "app_store",
      cancelled: false,
    });
    s.enqueueDump({ kind: "text", text: "draft" });
  });

  it("wipes user, tasks, goals, reflections, premium, pendingDumps", () => {
    useAppStore.getState().resetAll();

    const s = useAppStore.getState();
    expect(s.user).toBeNull();
    expect(s.isOnboarded).toBe(false);
    expect(s.todayTasks).toEqual([]);
    expect(s.allTasks).toEqual([]);
    expect(s.goals).toEqual([]);
    expect(s.reflections).toEqual([]);
    expect(s.reflectionStats).toBeNull();
    expect(s.pendingDumps).toEqual([]);
    expect(s.premium.is_premium).toBe(false);
    expect(s.premium.entitlement_id).toBeNull();
    expect(s.premium.cancelled).toBe(false);
  });

  it("is idempotent — calling twice leaves the same state", () => {
    useAppStore.getState().resetAll();
    const firstSnapshot = { ...useAppStore.getState() };
    useAppStore.getState().resetAll();
    const secondSnapshot = useAppStore.getState();

    expect(secondSnapshot.user).toBe(firstSnapshot.user);
    expect(secondSnapshot.goals).toEqual(firstSnapshot.goals);
    expect(secondSnapshot.premium).toEqual(firstSnapshot.premium);
  });
});
