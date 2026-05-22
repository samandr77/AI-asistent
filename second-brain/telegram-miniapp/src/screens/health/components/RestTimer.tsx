import { useEffect, useState } from "react";

import {
  restTimerRemaining,
  useActiveWorkoutStore,
} from "../../../store/useActiveWorkoutStore";

export function RestTimer() {
  const timer = useActiveWorkoutStore((s) => s.restTimer);
  const clearRestTimer = useActiveWorkoutStore((s) => s.clearRestTimer);
  const [remaining, setRemaining] = useState(() => restTimerRemaining(timer));

  useEffect(() => {
    if (!timer) {
      setRemaining(0);
      return;
    }
    setRemaining(restTimerRemaining(timer));
    const id = window.setInterval(() => {
      setRemaining(restTimerRemaining(timer));
    }, 250);
    return () => window.clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const done = remaining <= 0;

  return (
    <div className={"rest-timer" + (done ? " rest-timer--done" : "")}>
      <div className="rest-timer-label">{done ? "Отдых окончен" : "Отдых"}</div>
      <div className="timer-big">
        {m}:{String(s).padStart(2, "0")}
      </div>
      <button
        type="button"
        className="rest-timer-skip"
        onClick={() => clearRestTimer()}
      >
        {done ? "Скрыть" : "Пропустить"}
      </button>
    </div>
  );
}
