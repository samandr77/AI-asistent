export type Sphere = "work" | "family" | "study" | "health" | "travel";

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
];

export const SPHERE_MAP = Object.fromEntries(
  SPHERES.map((s) => [s.id, s]),
) as Record<Sphere, SphereInfo>;
