import type { QualityTier } from "@/world/quality/tiers";

export interface DetectResult {
  webgl2: boolean;
  software: boolean;
  renderer: string;
  mobile: boolean;
  cores: number;
  memoryGB?: number;
  screenMP: number;
  saveData: boolean;
  reducedMotion: boolean;
  cached: QualityTier | null;
}

function isTier(value: string | null): value is QualityTier {
  return value === "static" || value === "low" || value === "medium" || value === "high";
}

export function detectCapabilities(): DetectResult {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGB = nav.deviceMemory;
  const screenMP = (screen.width * screen.height) / 1_000_000;
  const saveData = Boolean(nav.connection?.saveData);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile =
    window.matchMedia("(pointer: coarse)").matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: false,
    powerPreference: "default",
    antialias: false,
  });
  if (!gl) {
    return {
      webgl2: false,
      software: true,
      renderer: "",
      mobile,
      cores,
      memoryGB,
      screenMP,
      saveData,
      reducedMotion,
      cached: null,
    };
  }

  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = ext
    ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "")
    : String(gl.getParameter(gl.RENDERER) || "");
  const software =
    /swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render|mesa offscreen|svga3d/i.test(
      renderer,
    );
  const lose = gl.getExtension("WEBGL_lose_context");
  lose?.loseContext();

  let cached: QualityTier | null = null;
  try {
    const stored = localStorage.getItem(`yedgar-tier:${renderer}`);
    if (isTier(stored)) cached = stored;
  } catch {
    cached = null;
  }

  return {
    webgl2: true,
    software,
    renderer,
    mobile,
    cores,
    memoryGB,
    screenMP,
    saveData,
    reducedMotion,
    cached,
  };
}

export function resolveTier(
  detected: DetectResult,
  override: "static" | "low" | "medium" | "high" | "auto" | null,
): QualityTier {
  if (!detected.webgl2) return "static";
  if (override && override !== "auto") return override;
  if (detected.saveData) return "static";
  // A live scene at a readable resolution does not hold 30fps here. The still
  // keeps the shot sharp and lets the compositor animate it.
  if (detected.software) return "static";
  if (detected.cached && detected.cached !== "static") return detected.cached;

  const renderer = detected.renderer.toLowerCase();
  const discrete = /nvidia|geforce|radeon\s(rx|pro)|rtx|gtx|apple m\d|apple gpu/.test(renderer);
  if (discrete && (detected.memoryGB ?? 8) >= 4 && !detected.mobile) return "high";
  if (
    /iris|uhd|adreno \(tm\) 6[4-9]|adreno \(tm\) 7|mali-g[78]|mali-g1|angle \(intel|angle \(amd/.test(
      renderer,
    )
  ) {
    return "medium";
  }
  if ((detected.memoryGB ?? 8) <= 3) return "low";
  if (detected.mobile && detected.cores <= 4) return "low";
  if (detected.mobile) return "medium";
  if (detected.cores <= 4 && detected.screenMP < 1) return "low";
  return "medium";
}
