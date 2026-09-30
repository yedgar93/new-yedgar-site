import {
  BackSide,
  ShaderMaterial,
  type ShaderMaterialParameters,
} from "three";
import { GRADE, LDR_EPILOGUE, SKY_UNIFORMS, skyFunction } from "@/world/atmosphere/shaders";
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

function skyFragment(octaves: number, baked: boolean) {
  if (baked) {
    return /* glsl */ `
varying vec3 vDir;
${SKY_UNIFORMS}
uniform samplerCube uSkyMap;
uniform float uHasSkyMap;
${GRADE}
void main() {
  vec3 dir = normalize(vDir);
  vec3 color = uHasSkyMap > 0.5
    ? textureCube(uSkyMap, dir).rgb
    : mix(uHorizon, uZenith, pow(clamp(dir.y, 0.0, 1.0), 0.72));
  float sunDot = dot(dir, normalize(uSunDir));
  color += vec3(1.0, 0.97, 0.92) * smoothstep(0.99955, 0.99988, sunDot) * 5.0 * uSunVis;
  float moonDot = dot(dir, normalize(uMoonDir));
  color += vec3(0.8, 0.86, 1.0) * smoothstep(0.9995, 0.99984, moonDot) * 2.2 * uNight;
  gl_FragColor = vec4(color, 1.0);
  ${LDR_EPILOGUE}
}
`;
  }
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

export function createSkyMaterial(octaves: number, ldr: boolean, baked = false) {
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
      uSkyMap: worldUniforms.uSkyMap,
      uHasSkyMap: worldUniforms.uHasSkyMap,
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment(octaves, baked),
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
