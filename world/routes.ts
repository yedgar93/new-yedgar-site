import type { SceneId } from "@/world/store/transition";

export interface CameraRig {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Horizontal field of view in degrees. Vertical FOV is derived from aspect. */
  fovX: number;
  parallax: readonly [number, number];
  skyLift: number;
  skyLook: number;
}

export const RIGS: Record<SceneId, CameraRig> = {
  ocean: {
    position: [0, 4.15, 8.8],
    target: [0, 1.05, 0],
    fovX: 74,
    parallax: [1.45, 0.34],
    skyLift: 7.5,
    skyLook: 52,
  },
  meadow: {
    position: [3.6, 6.6, 20.5],
    target: [1.2, 5.4, -8],
    fovX: 56,
    parallax: [0.4, 0.14],
    skyLift: 9,
    skyLook: 42,
  },
  plain: {
    position: [0, 14, 18],
    target: [0, 36, -10],
    fovX: 60,
    parallax: [0, 0],
    skyLift: 0,
    skyLook: 0,
  },
};

export function sceneForPath(path: string): "ocean" | "meadow" | null {
  if (path === "/") return "ocean";
  if (path === "/music" || path.startsWith("/music/")) return "meadow";
  return null;
}

export function isWorldPath(path: string): boolean {
  return sceneForPath(path) != null;
}
