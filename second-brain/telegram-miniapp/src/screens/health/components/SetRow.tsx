import { useState } from "react";

import type { WorkoutSet, WorkoutSetUpdate } from "../../../types/api";

interface Props {
  set: WorkoutSet;
  onChange: (patch: WorkoutSetUpdate) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export function SetRow({ set, onChange, onDelete, readOnly }: Props) {
  const [reps, setReps] = useState<string>(
    set.reps != null ? String(set.reps) : "",
  );
  const [weight, setWeight] = useState<string>(
    set.weight_kg != null ? String(set.weight_kg) : "",
  );
  const [rpe, setRpe] = useState<string>(
    set.rpe != null ? String(set.rpe) : "",
  );

  function commitReps() {
    const n = reps.trim() === "" ? null : Number(reps);
    if (n !== set.reps) onChange({ reps: n });
  }

  function commitWeight() {
    const n = weight.trim() === "" ? null : Number(weight);
    if (n !== set.weight_kg) onChange({ weight_kg: n });
  }

  function commitRpe() {
    const n = rpe.trim() === "" ? null : Number(rpe);
    if (n !== set.rpe) onChange({ rpe: n });
  }

  return (
    <div
      className={
        "set-row" +
        (set.is_warmup ? " set-row--warmup" : "") +
        (set.is_dropset ? " set-row--dropset" : "")
      }
    >
      <div className="set-row-num">{set.is_warmup ? "W" : set.set_number}</div>
      <input
        className="set-row-input"
        type="number"
        inputMode="numeric"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commitWeight}
        placeholder="кг"
        aria-label="Вес"
        disabled={readOnly}
      />
      <span className="set-row-x">×</span>
      <input
        className="set-row-input"
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commitReps}
        placeholder="повт"
        aria-label="Повторений"
        disabled={readOnly}
      />
      <input
        className="set-row-input set-row-input--rpe"
        type="number"
        inputMode="numeric"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        onBlur={commitRpe}
        placeholder="RPE"
        aria-label="RPE"
        disabled={readOnly}
      />
      {!readOnly ? (
        <button
          type="button"
          className="set-row-del"
          aria-label="Удалить подход"
          onClick={onDelete}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
