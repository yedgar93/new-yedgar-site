import { AgXToneMapping, NoToneMapping, SRGBColorSpace, type WebGLRenderer } from "three";
import type { QualitySettings } from "@/world/quality/tiers";
import { setExposure } from "@/world/runtime/mutations";

export function applyRenderer(gl: WebGLRenderer, settings: QualitySettings) {
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = settings.composer ? NoToneMapping : AgXToneMapping;
  setExposure(gl);
  gl.setPixelRatio(settings.dpr);
  gl.shadowMap.enabled = false;
}

export function supportsHalfFloat(gl: WebGLRenderer) {
  const context = gl.getContext();
  return Boolean(
    context.getExtension("EXT_color_buffer_float") ||
      context.getExtension("EXT_color_buffer_half_float"),
  );
}
