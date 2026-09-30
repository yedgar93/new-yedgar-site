import type { SceneId } from "@/world/store/transition";

export interface CameraRig {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Vertical field of view in degrees. Matches the original canvases (R3F default 75). */
  fov: number;
  parallax: readonly [number, number];
  skyLift: number;
  skyLook: number;
}

/** Resting shots copied from the original ocean carousel and meadow camera. */
export const RIGS: Record<SceneId, CameraRig> = {
  ocean: {
    position: [0, 4.5, 9],
    target: [0, 0, 0],
    fov: 75,
    parallax: [-2, 2],
    skyLift: 8,
    skyLook: 46,
  },
  meadow: {
    position: [4, 8, 25],
    target: [0, 10, -20],
    fov: 75,
    parallax: [0.25, 0.1],
    skyLift: 10,
    skyLook: 34,
  },
  plain: {
    position: [0, 14, 18],
    target: [0, 36, -10],
    fov: 75,
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
