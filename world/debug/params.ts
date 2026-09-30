export interface DebugParams {
  perf: "static" | "low" | "medium" | "high" | "auto" | null;
  time: number | null;
  freeze: boolean;
  forceNight: boolean;
  debug: boolean;
}

const FALLBACK: DebugParams = {
  perf: null,
  time: null,
  freeze: false,
  forceNight: false,
  debug: false,
};

let cached: DebugParams | null = null;

/** Parsed once on the client. Not read from location inside the frame loop. */
export function readParams(): DebugParams {
  if (cached) return cached;
  if (typeof window === "undefined") return FALLBACK;
  const q = new URLSearchParams(window.location.search);
  const perfRaw = q.get("perf");
  const perf =
    perfRaw === "static" ||
    perfRaw === "low" ||
    perfRaw === "medium" ||
    perfRaw === "high" ||
    perfRaw === "auto"
      ? perfRaw
      : null;
  const timeRaw = q.get("time");
  const time = timeRaw == null || timeRaw === "" ? null : Number(timeRaw);
  cached = {
    perf,
    time: time != null && Number.isFinite(time) ? time : null,
    freeze: q.get("freeze") === "1",
    forceNight: q.get("forcenight") === "1",
    debug: q.get("debug") === "1",
  };
  return cached;
}
