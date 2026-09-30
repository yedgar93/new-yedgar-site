export type RGB = [number, number, number];

export interface WorldTimeState {
  mode: "cycle" | "fixed";
  frozen: boolean;
  timeOfDay: number;
  cycleSeconds: number;
  elapsed: number;
  sunDir: { x: number; y: number; z: number };
  moonDir: { x: number; y: number; z: number };
  sunElevation: number;
  dayFactor: number;
  twilight: number;
  night: number;
  exposure: number;
  waveEnergy: number;
  windAngle: number;
  windStrength: number;
  sunColor: RGB;
  moonColor: RGB;
  zenith: RGB;
  horizon: RGB;
  fogColor: RGB;
  ambientSky: RGB;
  ambientGround: RGB;
  skyTopCss: string;
  skyHorizonCss: string;
}

const CYCLE_SECONDS = 90;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerp3(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function srgbByte(channel: number) {
  const encoded =
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.round(clamp01(encoded) * 255);
}

function css(color: RGB) {
  return `rgb(${srgbByte(color[0])}, ${srgbByte(color[1])}, ${srgbByte(color[2])})`;
}

/** Preserves the old calm → big → medium ocean cycle (20s / 30s / 20s). */
function waveEnergyAt(elapsed: number) {
  const t = ((elapsed % 70) + 70) % 70;
  const calm = 0.34;
  const big = 1;
  const mid = 0.6;
  if (t < 15) return calm;
  if (t < 20) return lerp(calm, big, smoothstep(0, 1, (t - 15) / 5));
  if (t < 45) return big;
  if (t < 50) return lerp(big, mid, smoothstep(0, 1, (t - 45) / 5));
  if (t < 65) return mid;
  return lerp(mid, calm, smoothstep(0, 1, (t - 65) / 5));
}

const zenithDay: RGB = [0.2, 0.42, 0.78];
const horizonDay: RGB = [0.66, 0.74, 0.82];
const zenithNight: RGB = [0.006, 0.01, 0.032];
const horizonNight: RGB = [0.04, 0.045, 0.09];
const zenithDusk: RGB = [0.16, 0.11, 0.32];
const horizonDusk: RGB = [0.86, 0.36, 0.2];

function createState(): WorldTimeState {
  return {
    mode: "cycle",
    frozen: false,
    timeOfDay: 0.42,
    cycleSeconds: CYCLE_SECONDS,
    elapsed: 22,
    sunDir: { x: 0, y: 1, z: 0 },
    moonDir: { x: 0, y: -1, z: 0 },
    sunElevation: 1,
    dayFactor: 1,
    twilight: 0,
    night: 0,
    exposure: 1,
    waveEnergy: 1,
    windAngle: 0.4,
    windStrength: 1,
    sunColor: [1, 0.95, 0.88],
    moonColor: [0.62, 0.7, 0.95],
    zenith: zenithDay,
    horizon: horizonDay,
    fogColor: horizonDay,
    ambientSky: [0.42, 0.5, 0.62],
    ambientGround: [0.16, 0.14, 0.18],
    skyTopCss: css(zenithDay),
    skyHorizonCss: css(horizonDay),
  };
}

const state = createState();
const listeners = new Set<() => void>();
let lastNotify = 0;
let lastBand = -1;

function recompute() {
  const ang = (state.timeOfDay - 0.25) * Math.PI * 2;
  const elev = Math.sin(ang);
  const hyp = Math.sqrt(Math.max(0, 1 - elev * elev));
  state.sunDir.x = Math.cos(ang) * hyp;
  state.sunDir.y = elev;
  state.sunDir.z = Math.sin(ang) * hyp;
  state.moonDir.x = -state.sunDir.x;
  state.moonDir.y = -state.sunDir.y;
  state.moonDir.z = -state.sunDir.z;
  state.sunElevation = elev;
  state.dayFactor = smoothstep(-0.08, 0.25, elev);
  state.night = 1 - smoothstep(-0.04, 0.2, elev);
  state.twilight = smoothstep(0.42, 0, Math.abs(elev)) * smoothstep(-0.25, 0.05, elev);

  let zenith = lerp3(zenithNight, zenithDay, state.dayFactor);
  let horizon = lerp3(horizonNight, horizonDay, state.dayFactor);
  zenith = lerp3(zenith, zenithDusk, state.twilight * 0.9);
  horizon = lerp3(horizon, horizonDusk, state.twilight);
  state.zenith = zenith;
  state.horizon = horizon;
  state.fogColor = lerp3(horizon, zenith, 0.12);
  state.sunColor = lerp3([1, 0.7, 0.42], [1, 0.96, 0.88], state.dayFactor);
  state.ambientSky = lerp3([0.035, 0.045, 0.09], [0.45, 0.52, 0.64], state.dayFactor);
  state.ambientGround = lerp3([0.02, 0.025, 0.04], [0.18, 0.15, 0.16], state.dayFactor);
  state.exposure = lerp(0.9, 1.06, state.dayFactor) + state.twilight * 0.12;
  state.waveEnergy = waveEnergyAt(state.elapsed);
  state.windStrength = state.frozen ? 0.9 : 0.82 + 0.18 * Math.sin(state.elapsed * 0.23);
  state.skyTopCss = css(zenith);
  state.skyHorizonCss = css(horizon);
}

function notify(force = false) {
  const band = Math.round(state.dayFactor * 24);
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (!force && band === lastBand && now - lastNotify < 200) return;
  lastBand = band;
  lastNotify = now;
  listeners.forEach((listener) => listener());
}

recompute();

export const worldTime = {
  get(): WorldTimeState {
    return state;
  },
  tick(dtSeconds: number) {
    const dt = Math.max(0, Math.min(0.05, dtSeconds));
    if (!state.frozen) {
      state.elapsed += dt;
      state.windAngle += dt * 0.07;
      if (state.mode === "cycle") {
        state.timeOfDay = (state.timeOfDay + dt / state.cycleSeconds) % 1;
      }
    }
    recompute();
    notify(false);
  },
  setFixed(timeOfDay: number, freeze: boolean) {
    state.mode = "fixed";
    state.frozen = freeze;
    state.timeOfDay = ((timeOfDay % 1) + 1) % 1;
    recompute();
    notify(true);
  },
  setCycle() {
    state.mode = "cycle";
    state.frozen = false;
    recompute();
    notify(true);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
