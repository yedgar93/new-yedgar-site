import {
  DataTexture,
  Matrix4,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  type Texture,
} from "three";
import { FOG_FN, GRADE, LDR_EPILOGUE, SKY_UNIFORMS, skyFunction } from "@/world/atmosphere/shaders";
import { worldUniforms } from "@/world/store/uniforms";
import type { QualitySettings } from "@/world/quality/tiers";

const WAVELENGTHS = [28, 17, 9.5, 6.2, 39, 13, 4.8, 22];
const STEEPNESS = [0.28, 0.34, 0.42, 0.5, 0.22, 0.38, 0.55, 0.3];
const AMPLITUDES = [0.42, 0.24, 0.12, 0.06, 0.3, 0.09, 0.04, 0.16];
const DIRS = [
  [1, 0.25],
  [0.35, 1],
  [-0.8, 0.45],
  [0.9, -0.3],
  [-0.2, 0.95],
  [0.6, -0.7],
  [-1, 0.1],
  [0.15, -1],
];

function oceanVertex(waves: number) {
  return /* glsl */ `
uniform float uTime;
uniform float uWaveEnergy;
uniform float uAmp[8];
uniform float uLen[8];
uniform float uSteep[8];
uniform vec2 uDir[8];
varying vec3 vWorld;
varying vec3 vNormal;

void gerstner(vec2 xz, out vec3 pos, out vec3 normal) {
  pos = vec3(xz.x, 0.0, xz.y);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < ${waves}; i++) {
    float k = 6.2831853 / uLen[i];
    float A = uAmp[i] * uWaveEnergy;
    float Q = uSteep[i];
    vec2 d = normalize(uDir[i]);
    float w = sqrt(9.8 * k);
    float phase = k * dot(d, xz) - w * uTime;
    float s = sin(phase);
    float c = cos(phase);
    pos.x += d.x * Q * A * c;
    pos.z += d.y * Q * A * c;
    pos.y += A * s;
    float kA = k * A;
    tangent.x -= Q * d.x * d.x * kA * s;
    tangent.y += d.x * kA * c;
    tangent.z -= Q * d.x * d.y * kA * s;
    binormal.x -= Q * d.x * d.y * kA * s;
    binormal.y += d.y * kA * c;
    binormal.z -= Q * d.y * d.y * kA * s;
  }
  normal = normalize(cross(binormal, tangent));
}

void main() {
  vec3 pos;
  vec3 nrm;
  gerstner(position.xz, pos, nrm);
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
}

function cheapReflect() {
  return /* glsl */ `
${GRADE}
vec3 skyRadiance(vec3 dir, vec3 cam) {
  dir = normalize(dir);
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizon, uZenith, pow(h, 0.55));
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  color += uSunColor * pow(sunDot, 28.0) * 1.15 * uSunVis;
  float moonDot = max(dot(dir, normalize(uMoonDir)), 0.0);
  color += vec3(0.75, 0.82, 1.0) * pow(moonDot, 36.0) * 1.4 * uNight;
  return color;
}
`;
}

function oceanFragment(waves: number, clouds: boolean, foam: boolean, planar: boolean) {
  const fullReflect = planar || clouds;
  return /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
uniform sampler2D uNormalMap;
uniform vec3 uCursor;
uniform float uCursorOn;
${SKY_UNIFORMS}
${planar ? "uniform sampler2D uReflection;\nuniform mat4 uReflMatrix;\nuniform float uHasReflection;" : ""}
${fullReflect ? skyFunction(2, clouds) : cheapReflect()}
${FOG_FN}

void main() {
  vec3 N = normalize(vNormal);
  vec3 mapN = texture2D(uNormalMap, vWorld.xz * 0.055 + vec2(uTime * 0.015, uTime * 0.008)).xyz * 2.0 - 1.0;
  vec3 T = normalize(cross(vec3(0.0, 0.0, 1.0), N));
  vec3 B = cross(N, T);
  N = normalize(T * mapN.x + B * mapN.y + N * (mapN.z * 0.65 + 0.85));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(N, V), 0.0);
  float fresnel = mix(0.02, 1.0, pow(1.0 - ndv, 4.5));
  vec3 R = reflect(-V, N);
  vec3 reflection = skyRadiance(R, cameraPosition);
  ${
    planar
      ? /* glsl */ `
  if (uHasReflection > 0.5) {
    vec4 clip = uReflMatrix * vec4(vWorld, 1.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    uv += N.xz * 0.015;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 hit = texture2D(uReflection, uv);
      reflection = mix(reflection, hit.rgb, hit.a * 0.85);
    }
  }
`
      : ""
  }

  vec3 deep = vec3(0.045, 0.035, 0.11);
  vec3 shallow = vec3(0.16, 0.11, 0.28);
  vec3 water = mix(deep, shallow, pow(1.0 - ndv, 1.6));
  water += uSunColor * smoothstep(0.12, 0.38, vWorld.y) * 0.12 * uSunVis;
  vec3 color = mix(water, reflection, fresnel);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float dist = length(vWorld - cameraPosition);
  float power = mix(90.0, 12.0, smoothstep(8.0, 140.0, dist));
  float spec = pow(max(dot(N, H), 0.0), power);
  color += uSunColor * spec * 2.6 * uSunVis;

  vec3 Lm = normalize(uMoonDir);
  vec3 Hm = normalize(Lm + V);
  float mspec = pow(max(dot(N, Hm), 0.0), 36.0);
  color += vec3(0.7, 0.78, 1.0) * mspec * 1.3 * uNight;

  vec3 toCursor = normalize(uCursor - vWorld);
  float lantern = exp(-length(vWorld.xz - uCursor.xz) * 0.22) * uCursorOn;
  float cspec = pow(max(dot(N, normalize(toCursor + V)), 0.0), 24.0);
  color += vec3(1.0, 0.82, 0.55) * cspec * lantern * 0.9;

  ${
    foam
      ? /* glsl */ `
  float foamNoise = vnoise(vWorld.xz * 0.85 + vec2(uTime * 0.15, -uTime * 0.08));
  float foam = smoothstep(0.16, 0.4, vWorld.y) * foamNoise;
  color = mix(color, vec3(0.72, 0.76, 0.82), foam * 0.5);
`
      : ""
  }

  color = applyFog(color, vWorld, cameraPosition);
  gl_FragColor = vec4(color, 1.0);
  ${LDR_EPILOGUE}
}
`;
}

export function createOceanGeometry(segments: number) {
  const geo = new PlaneGeometry(560, 560, segments, segments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createFlatNormal(): DataTexture {
  const data = new Uint8Array([128, 128, 255, 255]);
  const tex = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  tex.needsUpdate = true;
  return tex;
}

export function createOceanMaterial(settings: QualitySettings, normalMap: Texture) {
  const waves = settings.ocean.waves;
  const defines: Record<string, number> = {};
  if (settings.ldrOutput) defines.LDR_OUTPUT = 1;
  const amp = new Array<number>(8).fill(0);
  const len = new Array<number>(8).fill(10);
  const steep = new Array<number>(8).fill(0);
  const dirs = Array.from({ length: 8 }, () => new Vector2(1, 0));
  for (let i = 0; i < waves; i++) {
    amp[i] = AMPLITUDES[i] ?? 0.04;
    len[i] = WAVELENGTHS[i] ?? 12;
    steep[i] = STEEPNESS[i] ?? 0.3;
    const pair = DIRS[i] ?? [1, 0];
    dirs[i] = new Vector2(pair[0], pair[1]).normalize();
  }
  const material = new ShaderMaterial({
    uniforms: {
      uTime: worldUniforms.uTime,
      uWaveEnergy: worldUniforms.uWaveEnergy,
      uAmp: { value: amp },
      uLen: { value: len },
      uSteep: { value: steep },
      uDir: { value: dirs },
      uNormalMap: { value: normalMap },
      uSunDir: worldUniforms.uSunDir,
      uMoonDir: worldUniforms.uMoonDir,
      uSunColor: worldUniforms.uSunColor,
      uZenith: worldUniforms.uZenith,
      uHorizon: worldUniforms.uHorizon,
      uDay: worldUniforms.uDay,
      uNight: worldUniforms.uNight,
      uTwilight: worldUniforms.uTwilight,
      uSunVis: worldUniforms.uSunVis,
      uStarRot: worldUniforms.uStarRot,
      uCloudOffset: worldUniforms.uCloudOffset,
      uCloudCoverage: worldUniforms.uCloudCoverage,
      uResolution: worldUniforms.uResolution,
      uAspect: worldUniforms.uAspect,
      uFogDensity: worldUniforms.uFogDensity,
      uFogColor: { value: worldUniforms.uFogColor.value },
      uCursor: worldUniforms.uCursor,
      uCursorOn: worldUniforms.uCursorOn,
      uReflection: { value: normalMap },
      uReflMatrix: { value: new Matrix4() },
      uHasReflection: { value: 0 },
    },
    vertexShader: oceanVertex(waves),
    fragmentShader: oceanFragment(
      waves,
      settings.ocean.cloudReflect,
      settings.ocean.foam,
      settings.ocean.reflection,
    ),
    defines,
  });
  material.fog = false;
  return material;
}

export function setOceanFogUniform(material: ShaderMaterial) {
  const fog = material.uniforms.uFogColor;
  if (fog) fog.value = worldUniforms.uFogColor.value;
}
