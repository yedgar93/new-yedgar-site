"use client";

import { readParams } from "@/world/debug/params";
import { detectCapabilities, resolveTier } from "@/world/quality/detect";
import { settingsFor, type QualitySettings, type QualityTier } from "@/world/quality/tiers";
import { worldTime } from "@/world/store/worldTime";

interface QualityState {
  ready: boolean;
  tier: QualityTier;
  settings: QualitySettings;
  renderer: string;
  losses: number;
}

const listeners = new Set<() => void>();

let state: QualityState = {
  ready: false,
  tier: "low",
  settings: settingsFor("low", false, false),
  renderer: "",
  losses: 0,
};

function emit() {
  listeners.forEach((listener) => listener());
}

function applyTier(tier: QualityTier, software: boolean, reducedMotion: boolean, renderer: string) {
  state = {
    ...state,
    ready: true,
    tier,
    settings: settingsFor(tier, software, reducedMotion),
    renderer,
  };
  if (typeof document !== "undefined") {
    document.documentElement.dataset.tier = tier;
    document.documentElement.dataset.software = software ? "1" : "0";
  }
  emit();
}

let booted = false;

export function bootQuality() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  const params = readParams();
  let override = params.perf;
  if (!override) {
    try {
      const saved = sessionStorage.getItem("yedgar-perf");
      if (
        saved === "static" ||
        saved === "low" ||
        saved === "medium" ||
        saved === "high" ||
        saved === "auto"
      ) {
        override = saved;
      }
    } catch {
      override = null;
    }
  } else {
    try {
      sessionStorage.setItem("yedgar-perf", override);
    } catch {
      /* private mode */
    }
  }

  const detected = detectCapabilities();
  const tier = resolveTier(detected, override);
  applyTier(tier, detected.software, detected.reducedMotion, detected.renderer);

  if (params.forceNight) worldTime.setFixed(0.02, true);
  else if (params.time != null) worldTime.setFixed(params.time, params.freeze);
  else if (params.freeze) worldTime.setFixed(worldTime.get().timeOfDay, true);
  else worldTime.setCycle();
}

export const quality = {
  get(): QualityState {
    return state;
  },
  getSettings(): QualitySettings {
    return state.settings;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setDpr(next: number) {
    const clamped = Math.min(state.settings.dprMax, Math.max(state.settings.dprMin, next));
    if (Math.abs(clamped - state.settings.dpr) < 0.02) return;
    state = {
      ...state,
      settings: { ...state.settings, dpr: Math.round(clamped * 100) / 100 },
    };
    emit();
  },
  stepDown(reason: string) {
    const order: QualityTier[] = ["high", "medium", "low"];
    const index = order.indexOf(state.tier);
    if (state.tier === "static" || state.tier === "low" || index === -1) {
      quality.setDpr(state.settings.dprMin);
      return;
    }
    const next = order[index + 1] ?? "low";
    applyTier(next, state.settings.software, state.settings.reducedMotion, state.renderer);
    try {
      localStorage.setItem(`yedgar-tier:${state.renderer}`, next);
    } catch {
      /* ignore */
    }
    if (typeof console !== "undefined") {
      console.info(`[yedgar] quality stepped to ${next} (${reason})`);
    }
  },
  noteContextLoss() {
    state = { ...state, losses: state.losses + 1 };
    if (state.losses >= 2) applyTier("static", state.settings.software, state.settings.reducedMotion, state.renderer);
    emit();
  },
};
