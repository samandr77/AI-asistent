import type { Sphere } from "../types/api";

export interface SphereInfo {
  id: Sphere;
  labelKey: string;
  color: string;
}

export const SPHERES: SphereInfo[] = [
  { id: "work", labelKey: "spheres.work", color: "#2574a9" },
  { id: "family", labelKey: "spheres.family", color: "#ad5d3d" },
  { id: "study", labelKey: "spheres.study", color: "#6f5aa8" },
  { id: "health", labelKey: "spheres.health", color: "#2f7d5c" },
  { id: "travel", labelKey: "spheres.travel", color: "#8d5f22" },
  { id: "finance", labelKey: "spheres.finance", color: "#8a7a18" },
  { id: "goals", labelKey: "spheres.goals", color: "#2f6f73" },
];

export const SPHERE_MAP = Object.fromEntries(
  SPHERES.map((sphere) => [sphere.id, sphere]),
) as Record<Sphere, SphereInfo>;
