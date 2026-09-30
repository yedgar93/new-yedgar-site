import {
  BackSide,
  ShaderMaterial,
  type ShaderMaterialParameters,
} from "three";
import { LDR_EPILOGUE, SKY_UNIFORMS, skyFunction } from "@/world/atmosphere/shaders";
import { worldUniforms } from "@/world/store/uniforms";

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w * 0.9995;
}
`;

function skyFragment(octaves: number) {
  return /* glsl */ `
varying vec3 vDir;
${SKY_UNIFORMS}
${skyFunction(octaves, true)}
void main() {
  vec3 color = skyRadiance(vDir, cameraPosition);
  gl_FragColor = vec4(color, 1.0);
  ${LDR_EPILOGUE}
}
`;
}

export function createSkyMaterial(octaves: number, ldr: boolean) {
  const defines: Record<string, number> = {};
  if (ldr) defines.LDR_OUTPUT = 1;
  const parameters: ShaderMaterialParameters = {
    uniforms: {
      uSunDir: worldUniforms.uSunDir,
      uMoonDir: worldUniforms.uMoonDir,
      uSunColor: worldUniforms.uSunColor,
      uZenith: worldUniforms.uZenith,
      uHorizon: worldUniforms.uHorizon,
      uDay: worldUniforms.uDay,
      uNight: worldUniforms.uNight,
      uTwilight: worldUniforms.uTwilight,
      uSunVis: worldUniforms.uSunVis,
      uTime: worldUniforms.uTime,
      uStarRot: worldUniforms.uStarRot,
      uCloudOffset: worldUniforms.uCloudOffset,
      uCloudCoverage: worldUniforms.uCloudCoverage,
      uResolution: worldUniforms.uResolution,
      uAspect: worldUniforms.uAspect,
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment(octaves),
    side: BackSide,
    depthWrite: false,
    depthTest: true,
    defines,
  };
  return new ShaderMaterial(parameters);
}

/** Linear radiance only — used by the PMREM probe so IBL is not pre-graded. */
export function createProbeSkyMaterial(octaves: number) {
  return createSkyMaterial(Math.min(octaves, 2) as 2, false);
}
