import type { Sphere } from "../types/api";
import { SPHERES } from "../constants/spheres";

interface SphereFilterProps {
  value: Sphere | "all";
  onChange: (value: Sphere | "all") => void;
}

export function SphereFilter({ value, onChange }: SphereFilterProps) {
  return (
    <div className="segmented" role="tablist" aria-label="Task sphere">
      <button
        className={value === "all" ? "active" : ""}
        type="button"
        onClick={() => onChange("all")}
      >
        All
      </button>
      {SPHERES.map((sphere) => (
        <button
          className={value === sphere.id ? "active" : ""}
          key={sphere.id}
          type="button"
          onClick={() => onChange(sphere.id)}
        >
          {sphere.id}
        </button>
      ))}
    </div>
  );
}
