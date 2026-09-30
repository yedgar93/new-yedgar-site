export const perfStats = {
  ready: false,
  frames: 0,
  ms: 0,
  fps: 0,
  tier: "",
  dpr: 1,
  calls: 0,
  tris: 0,
  renderer: "",
  software: false,
};

export function publishPerfStats(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __yedgarPerf?: typeof perfStats }).__yedgarPerf = perfStats;
}
