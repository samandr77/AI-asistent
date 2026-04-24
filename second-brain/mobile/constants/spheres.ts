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
  label: string;
  icon: string;
  color: string;
}

export const SPHERES: SphereInfo[] = [
  { id: "work", label: "Работа", icon: "💼", color: "#4F8EF7" },
  { id: "family", label: "Семья", icon: "👨‍👩‍👧", color: "#F7934C" },
  { id: "study", label: "Учёба", icon: "📚", color: "#9B59B6" },
  { id: "health", label: "Здоровье", icon: "💪", color: "#2ECC71" },
  { id: "travel", label: "Поездки", icon: "✈️", color: "#E74C3C" },
  { id: "finance", label: "Финансы", icon: "💰", color: "#F1C40F" },
  { id: "goals", label: "Цели", icon: "🎯", color: "#1ABC9C" },
];

export const SPHERE_MAP = Object.fromEntries(
  SPHERES.map((s) => [s.id, s]),
) as Record<Sphere, SphereInfo>;
