import { AgXToneMapping, NoToneMapping, ReinhardToneMapping, SRGBColorSpace, type WebGLRenderer } from "three";
import type { QualitySettings } from "@/world/quality/tiers";
import { setExposure } from "@/world/runtime/mutations";
import { transition } from "@/world/store/transition";

export function applyRenderer(gl: WebGLRenderer, settings: QualitySettings) {
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = settings.composer ? NoToneMapping : settings.software ? ReinhardToneMapping : AgXToneMapping;
  setExposure(gl);
  let dpr = settings.dpr;
  if (settings.software && transition.get().scene === "meadow") {
    dpr = Math.min(settings.dpr, Math.max(0.26, settings.dpr * 0.58));
  }
  gl.setPixelRatio(dpr);
  gl.shadowMap.enabled = false;
}

export function supportsHalfFloat(gl: WebGLRenderer) {
  const context = gl.getContext();
  return Boolean(
    context.getExtension("EXT_color_buffer_float") ||
      context.getExtension("EXT_color_buffer_half_float"),
  );
}
