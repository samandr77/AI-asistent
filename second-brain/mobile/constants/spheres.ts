export type Sphere =
  | "work"
  | "family"
  | "study"
  | "health"
  | "travel"
  | "finance"
  | "goals";

export interface SphereInfo {
  id: Sphere;
  /** i18n key — pass through `t()` at the render site, e.g. `t('spheres.work')`. */
  labelKey: string;
  icon: string;
  color: string;
}

export const SPHERES: SphereInfo[] = [
  { id: "work", labelKey: "spheres.work", icon: "💼", color: "#4F8EF7" },
  { id: "family", labelKey: "spheres.family", icon: "👨‍👩‍👧", color: "#F7934C" },
  { id: "study", labelKey: "spheres.study", icon: "📚", color: "#9B59B6" },
  { id: "health", labelKey: "spheres.health", icon: "💪", color: "#2ECC71" },
  { id: "travel", labelKey: "spheres.travel", icon: "✈️", color: "#E74C3C" },
  { id: "finance", labelKey: "spheres.finance", icon: "💰", color: "#F1C40F" },
  { id: "goals", labelKey: "spheres.goals", icon: "🎯", color: "#1ABC9C" },
];

export const SPHERE_MAP = Object.fromEntries(
  SPHERES.map((s) => [s.id, s]),
) as Record<Sphere, SphereInfo>;
