import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  restTimerRemaining,
  useActiveWorkoutStore,
} from "../src/store/useActiveWorkoutStore";

function resetStore() {
  useActiveWorkoutStore.setState({
    sessionId: null,
    sportKind: null,
    startedAt: null,
    restTimer: null,
    autoRestEnabled: true,
  });
}

describe("useActiveWorkoutStore", () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });
  afterEach(() => resetStore());

  it("start() registers active session with sport kind", () => {
    useActiveWorkoutStore.getState().start({
      sessionId: "sess-1",
      sportKind: "running",
    });
    const state = useActiveWorkoutStore.getState();
    expect(state.sessionId).toBe("sess-1");
    expect(state.sportKind).toBe("running");
    expect(state.startedAt).not.toBeNull();
  });

  it("stop() clears the session and timer", () => {
    const store = useActiveWorkoutStore.getState();
    store.start({ sessionId: "sess-1", sportKind: null });
    store.startRestTimer(90, "set-1");
    expect(useActiveWorkoutStore.getState().restTimer).not.toBeNull();

    useActiveWorkoutStore.getState().stop();
    const state = useActiveWorkoutStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.restTimer).toBeNull();
  });

  it("startRestTimer + clearRestTimer toggles timer state", () => {
    const store = useActiveWorkoutStore.getState();
    store.start({ sessionId: "sess-1", sportKind: null });
    store.startRestTimer(60, "set-1");
    expect(useActiveWorkoutStore.getState().restTimer?.durationSec).toBe(60);
    useActiveWorkoutStore.getState().clearRestTimer();
    expect(useActiveWorkoutStore.getState().restTimer).toBeNull();
  });

  it("restTimerRemaining counts down based on startedAt", () => {
    const tenSecondsAgo = Date.now() - 10_000;
    const remaining = restTimerRemaining({
      startedAt: tenSecondsAgo,
      durationSec: 30,
      setId: null,
    });
    expect(remaining).toBeGreaterThan(15);
    expect(remaining).toBeLessThanOrEqual(20);
  });

  it("restTimerRemaining returns 0 when expired", () => {
    const remaining = restTimerRemaining({
      startedAt: Date.now() - 120_000,
      durationSec: 60,
      setId: null,
    });
    expect(remaining).toBe(0);
  });

  it("restTimerRemaining returns 0 when timer is null", () => {
    expect(restTimerRemaining(null)).toBe(0);
  });

  it("setAutoRest updates the flag", () => {
    useActiveWorkoutStore.getState().setAutoRest(false);
    expect(useActiveWorkoutStore.getState().autoRestEnabled).toBe(false);
    useActiveWorkoutStore.getState().setAutoRest(true);
    expect(useActiveWorkoutStore.getState().autoRestEnabled).toBe(true);
  });
});
