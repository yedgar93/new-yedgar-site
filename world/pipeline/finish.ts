import type { Material } from "three";
import { worldUniforms } from "@/world/store/uniforms";

const FINISH = /* glsl */ `
#ifdef LDR_OUTPUT
{
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float vig = smoothstep(0.95, 0.28, length(p));
  gl_FragColor.rgb *= mix(0.8, 1.0, vig);
  float gn = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 18.0), vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor.rgb += (gn - 0.5) * 0.038;
}
#endif
`;

/** Vignette and grain for built-in materials on the no-composer path. */
export function bindFinish(material: Material, ldr: boolean) {
  const defines = { ...(material.defines ?? {}) };
  if (ldr) defines.LDR_OUTPUT = 1;
  else delete defines.LDR_OUTPUT;
  material.defines = defines;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uResolution = worldUniforms.uResolution;
    shader.uniforms.uAspect = worldUniforms.uAspect;
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>\n${FINISH}`,
    );
    shader.fragmentShader =
      "uniform vec2 uResolution;\nuniform float uAspect;\nuniform float uTime;\n" +
      shader.fragmentShader;
  };
  material.needsUpdate = true;
}
