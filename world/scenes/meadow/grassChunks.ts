import {
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  Matrix4,
  Object3D,
  ShaderMaterial,
  Sphere,
  Vector3,
} from "three";
import { FOG_FN, GRADE, LDR_EPILOGUE } from "@/world/atmosphere/shaders";
import type { QualitySettings } from "@/world/quality/tiers";
import { worldUniforms } from "@/world/store/uniforms";
import { terrainHeight } from "@/world/scenes/meadow/terrain";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tuftGeometry() {
  const geo = new BufferGeometry();
  const position = new Float32Array(27);
  const angles = [0, Math.PI / 3, -Math.PI / 3];
  const corners: Array<[number, number, number]> = [
    [-0.5, 0, 0],
    [0.5, 0, 0],
    [0, 1, 0.08],
  ];
  let offset = 0;
  for (const angle of angles) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (const [x, y, z] of corners) {
      position[offset++] = x * c - z * s;
      position[offset++] = y;
      position[offset++] = x * s + z * c;
    }
  }
  geo.setAttribute("position", new BufferAttribute(position, 3));
  geo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  return geo;
}

function bladeGeometry(segments: 1 | 2) {
  const geo = new BufferGeometry();
  const position =
    segments === 1
      ? new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0.05])
      : new Float32Array([
          -0.5, 0, 0, 0.5, 0, 0, -0.28, 0.5, 0.04, 0.28, 0.5, 0.04, 0, 1, 0.12,
        ]);
  const index = segments === 1 ? [0, 1, 2] : [0, 1, 3, 0, 3, 2, 2, 3, 4];
  geo.setAttribute("position", new BufferAttribute(position, 3));
  geo.setIndex(index);
  return geo;
}

const grassVertex = /* glsl */ `
attribute float aSeed;
attribute float aHeight;
attribute float aWidth;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
varying float vSeed;
varying float vSide;
uniform float uTime;
uniform float uWindStrength;
uniform vec3 uCursor;
uniform float uCursorOn;

void main() {
  float h = clamp(position.y, 0.0, 1.0);
  vH = h;
  vSeed = aSeed;
  vSide = position.x * 2.0;
  vec3 p = position;
  p.x *= aWidth;
  p.y *= aHeight;
  vec3 inst = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float gust = sin(uTime * 1.15 + inst.x * 0.17 + inst.z * 0.11);
  float flutter = sin(uTime * 5.2 + aSeed * 28.0);
  float sway = (gust * 0.34 + flutter * 0.04) * uWindStrength * h * h;
  p.x += sway;
  p.z += sway * 0.4 + h * h * 0.12;
  vec2 away = inst.xz - uCursor.xz;
  float push = exp(-length(away) * 1.25) * uCursorOn * h;
  p.x += away.x * push * 0.6;
  p.z += away.y * push * 0.6;
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vec3 nLocal = normalize(vec3(vSide * 0.7, 0.12, 1.0));
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * nLocal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const grassFragment = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
varying float vSeed;
varying float vSide;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uMoonColor;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform float uNight;
uniform float uSunVis;
uniform vec2 uCloudOffset;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
${GRADE}
${FOG_FN}
float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 base = mix(vec3(0.04, 0.14, 0.025), vec3(0.18, 0.46, 0.07), smoothstep(0.0, 0.5, vH));
  base = mix(base, vec3(0.55, 0.52, 0.16), smoothstep(0.62, 1.0, vH));
  base *= mix(0.78, 1.25, vSeed);
  base = mix(base, base + vec3(0.08, 0.03, -0.03), vSeed);
  base = mix(base, base * vec3(0.62, 0.72, 0.95), uNight * 0.55);

  vec3 L = normalize(uSunDir);
  float wrap = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float trans = pow(clamp(dot(V, -L), 0.0, 1.0), 4.0) * vH * vH;
  float hemiW = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 hemi = mix(uAmbientGround, uAmbientSky, hemiW);
  float ao = mix(0.42, 1.0, smoothstep(0.0, 0.4, vH));
  vec3 col = base * (hemi + uSunColor * wrap * uSunVis) * ao;
  col += uSunColor * trans * 0.65 * uSunVis;
  vec3 Lm = normalize(uMoonDir);
  float moon = clamp((dot(N, Lm) + 0.45) / 1.45, 0.0, 1.0);
  col += base * uMoonColor * moon * uNight * 0.7;
  col += base * 0.06;

  #ifdef CLOUD_SHADOW
    float cloud = vnoise(vWorld.xz * 0.02 + uCloudOffset);
    col *= mix(0.72, 1.0, smoothstep(0.32, 0.72, cloud));
  #endif

  vec2 shadowCenter = vec2(8.2, -1.5) - uSunDir.xz * 3.0;
  float blob = smoothstep(5.5, 1.1, length(vWorld.xz - shadowCenter));
  col *= mix(1.0, 0.58, blob * uSunVis);

  col = applyFog(col, vWorld, cameraPosition);
  float alpha = 1.0;
  #ifdef USE_A2C
    alpha = 1.0 - smoothstep(0.62, 1.0, abs(vSide));
  #endif
  gl_FragColor = vec4(col, alpha);
  ${LDR_EPILOGUE}
}
`;

export function createGrassMaterial(settings: QualitySettings) {
  const defines: Record<string, number> = {};
  if (settings.ldrOutput) defines.LDR_OUTPUT = 1;
  if (settings.grass.alphaToCoverage) defines.USE_A2C = 1;
  if (settings.grass.cloudShadows) defines.CLOUD_SHADOW = 1;
  const material = new ShaderMaterial({
    uniforms: {
      uTime: worldUniforms.uTime,
      uWindStrength: worldUniforms.uWindStrength,
      uCursor: worldUniforms.uCursor,
      uCursorOn: worldUniforms.uCursorOn,
      uSunDir: worldUniforms.uSunDir,
      uMoonDir: worldUniforms.uMoonDir,
      uSunColor: worldUniforms.uSunColor,
      uMoonColor: worldUniforms.uMoonColor,
      uAmbientSky: worldUniforms.uAmbientSky,
      uAmbientGround: worldUniforms.uAmbientGround,
      uNight: worldUniforms.uNight,
      uSunVis: worldUniforms.uSunVis,
      uCloudOffset: worldUniforms.uCloudOffset,
      uResolution: worldUniforms.uResolution,
      uAspect: worldUniforms.uAspect,
      uFogColor: { value: worldUniforms.uFogColor.value },
      uFogDensity: worldUniforms.uFogDensity,
    },
    vertexShader: grassVertex,
    fragmentShader: grassFragment,
    defines,
  });
  material.side = 2;
  material.alphaToCoverage = settings.grass.alphaToCoverage;
  return material;
}

export interface GrassChunkMesh {
  geometry: BufferGeometry;
  count: number;
}

export function buildGrassChunks(
  blades: number,
  radius: number,
  segments: 1 | 2,
  heightScale = 1,
  widthScale = 1,
  tuft = false,
) {
  const rng = mulberry32(20260330);
  const chunk = 24;
  const groups = new Map<string, { x: number; z: number; h: number; w: number; seed: number; yaw: number }[]>();
  for (let i = 0; i < blades; i++) {
    const mode = rng();
    let x: number;
    let z: number;
    if (mode < 0.62) {
      x = -16 + rng() * 36;
      z = 0 + rng() * 24;
    } else if (mode < 0.9) {
      x = -6 + rng() * 26;
      z = -18 + rng() * 20;
    } else {
      x = (rng() * 2 - 1) * radius;
      z = (rng() * 2 - 1) * radius * 0.75;
    }
    const key = `${Math.floor(x / chunk)}:${Math.floor(z / chunk)}`;
    const list = groups.get(key);
    const blade = {
      x,
      z,
      h: (0.85 + rng() * 1.05) * heightScale,
      w: (0.055 + rng() * 0.07) * widthScale,
      seed: rng(),
      yaw: rng() * Math.PI * 2,
    };
    if (list) list.push(blade);
    else groups.set(key, [blade]);
  }

  const dummy = new Object3D();
  const matrix = new Matrix4();
  const meshes: { geometry: BufferGeometry; matrices: Float32Array; count: number; sphere: Sphere }[] = [];
  for (const list of groups.values()) {
    const count = list.length;
    const seeds = new Float32Array(count);
    const heights = new Float32Array(count);
    const widths = new Float32Array(count);
    const matrices = new Float32Array(count * 16);
    let cx = 0;
    let cz = 0;
    list.forEach((blade, index) => {
      const y = terrainHeight(blade.x, blade.z);
      dummy.position.set(blade.x, y, blade.z);
      dummy.rotation.set(0, blade.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      matrices.set(matrix.elements, index * 16);
      seeds[index] = blade.seed;
      heights[index] = blade.h;
      widths[index] = blade.w;
      cx += blade.x;
      cz += blade.z;
    });
    cx /= count;
    cz /= count;
    let maxR = 1;
    for (const blade of list) maxR = Math.max(maxR, Math.hypot(blade.x - cx, blade.z - cz));
    const geometry = tuft ? tuftGeometry() : bladeGeometry(segments);
    geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute("aHeight", new InstancedBufferAttribute(heights, 1));
    geometry.setAttribute("aWidth", new InstancedBufferAttribute(widths, 1));
    geometry.boundingSphere = new Sphere(new Vector3(cx, 2, cz), maxR + 2);
    meshes.push({ geometry, matrices, count, sphere: geometry.boundingSphere });
  }
  return meshes;
}
