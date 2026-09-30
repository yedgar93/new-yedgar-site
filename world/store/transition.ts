export type SceneId = "ocean" | "meadow" | "plain";
export type TransitionPhase = "idle" | "leaving" | "entering";

export interface TransitionSnapshot {
  scene: SceneId;
  phase: TransitionPhase;
}

/** Tweaked by GSAP from the camera director. Not React state. */
export const transitionMotion = { pitch: 0, dip: 0 };

let snapshot: TransitionSnapshot = { scene: "plain", phase: "idle" };
let desired: SceneId = "plain";
const listeners = new Set<() => void>();
const desireListeners = new Set<(scene: SceneId) => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const transition = {
  get(): TransitionSnapshot {
    return snapshot;
  },
  getDesired(): SceneId {
    return desired;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  subscribeDesired(listener: (scene: SceneId) => void) {
    desireListeners.add(listener);
    return () => {
      desireListeners.delete(listener);
    };
  },
  setScene(scene: SceneId) {
    desired = scene;
    if (snapshot.scene === scene && snapshot.phase === "idle") return;
    snapshot = { scene, phase: "idle" };
    emit();
  },
  request(scene: SceneId) {
    if (desired === scene && snapshot.scene === scene) return;
    desired = scene;
    desireListeners.forEach((listener) => listener(scene));
  },
};
