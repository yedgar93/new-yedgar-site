import { ACESFilmicToneMapping, AgXToneMapping, NoToneMapping, SRGBColorSpace, type WebGLRenderer } from "three";
import type { QualitySettings } from "@/world/quality/tiers";
import { setExposure } from "@/world/runtime/mutations";

export function applyRenderer(gl: WebGLRenderer, settings: QualitySettings) {
  gl.outputColorSpace = SRGBColorSpace;
  // AgX on GPU tiers. Software uses the built-in ACES curve: a few ALUs, and it
  // keeps the sky blue. Reinhard was crushing the gradient into grey.
  gl.toneMapping =
    settings.composer ? NoToneMapping : settings.software ? ACESFilmicToneMapping : AgXToneMapping;
  setExposure(gl);
  gl.setPixelRatio(Math.max(0.6, settings.dpr));
  gl.shadowMap.enabled = false;
}

export function supportsHalfFloat(gl: WebGLRenderer) {
  const context = gl.getContext();
  return Boolean(
    context.getExtension("EXT_color_buffer_float") ||
      context.getExtension("EXT_color_buffer_half_float"),
  );
}
