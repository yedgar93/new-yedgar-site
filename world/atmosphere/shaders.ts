const NOISE = /* glsl */ `
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
`;

export const GRADE = /* glsl */ `
void applyGrade(inout vec3 color) {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float vig = smoothstep(0.95, 0.28, length(p));
  color *= mix(0.8, 1.0, vig);
  float gn = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 18.0), vec2(12.9898, 78.233))) * 43758.5453);
  color += (gn - 0.5) * 0.038;
}
`;

export const SKY_UNIFORMS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uDay;
uniform float uNight;
uniform float uTwilight;
uniform float uSunVis;
uniform float uTime;
uniform float uStarRot;
uniform vec2 uCloudOffset;
uniform float uCloudCoverage;
uniform vec2 uResolution;
uniform float uAspect;
`;

function cloudBlock(octaves: number) {
  return /* glsl */ `
  if (dir.y > 0.03) {
    float alt = 90.0;
    float t = (alt - cam.y) / dir.y;
    vec2 xz = cam.xz + dir.xz * t;
    vec2 uv = xz * 0.0035 + uCloudOffset;
    float n = 0.0;
    float a = 0.55;
    vec2 pp = uv;
    for (int i = 0; i < ${octaves}; i++) {
      n += a * vnoise(pp);
      pp = pp * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    float cl = smoothstep(uCloudCoverage, uCloudCoverage + 0.22, n);
    float n2 = vnoise(uv + uSunDir.xz * 0.45);
    float lit = clamp(n2 - n + 0.62, 0.0, 1.0);
    vec3 cloudCol = mix(vec3(0.22, 0.25, 0.34), vec3(0.97, 0.95, 0.93), lit);
    cloudCol = mix(cloudCol, uHorizon * 1.35, uTwilight * 0.85);
    cloudCol = mix(cloudCol, cloudCol * vec3(0.45, 0.5, 0.7), uNight);
    float fade = smoothstep(0.02, 0.2, dir.y);
    color = mix(color, cloudCol, cl * 0.92 * fade);
  }
`;
}

export function skyFunction(octaves: number, clouds: boolean) {
  return /* glsl */ `
${NOISE}
vec3 skyRadiance(vec3 dir, vec3 cam) {
  dir = normalize(dir);
  float h = clamp(dir.y, -0.05, 1.0);
  float skyGrad = pow(1.0 - max(h, 0.0), 1.55);
  vec3 color = mix(uZenith, uHorizon, skyGrad);
  float below = smoothstep(0.02, -0.08, dir.y);
  color = mix(color, uHorizon * 0.72, below);

  float sunDot = dot(dir, normalize(uSunDir));
  float sunDisc = smoothstep(0.99955, 0.99986, sunDot);
  float sunGlow = pow(max(sunDot, 0.0), 14.0);
  color += vec3(1.0, 0.96, 0.9) * sunDisc * 7.0 * uSunVis;
  color += uSunColor * sunGlow * 0.55 * uSunVis;

  float moonDot = dot(dir, normalize(uMoonDir));
  float moonDisc = smoothstep(0.9995, 0.99982, moonDot);
  float moonHalo = pow(max(moonDot, 0.0), 48.0);
  color += vec3(0.78, 0.84, 1.0) * (moonDisc * 2.6 + moonHalo * 0.35) * uNight;

  vec3 starDir = dir;
  float cs = cos(uStarRot);
  float sn = sin(uStarRot);
  starDir.xz = mat2(cs, -sn, sn, cs) * starDir.xz;
  vec3 g = starDir * 86.0;
  vec3 cell = floor(g);
  vec3 f = fract(g) - 0.5;
  float hs = hash12(cell.xy + cell.z * 13.1);
  float star = smoothstep(0.16, 0.0, length(f)) * step(0.972, hs);
  star *= 0.65 + 0.35 * sin(uTime * 1.7 + hs * 40.0);
  star *= smoothstep(0.0, 0.12, dir.y) * uNight;
  color += vec3(0.85, 0.88, 1.0) * star * 1.4;

  ${clouds ? cloudBlock(octaves) : ""}
  return color;
}
${GRADE}
`;
}

export const FOG_FN = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 color, vec3 worldPos, vec3 camPos) {
  float dist = length(worldPos - camPos);
  float f = 1.0 - exp(-dist * uFogDensity);
  vec3 viewDir = normalize(worldPos - camPos);
  float sun = pow(max(dot(viewDir, normalize(uSunDir)), 0.0), 10.0);
  vec3 fogCol = mix(uFogColor, uSunColor, sun * 0.28 * uSunVis);
  return mix(color, fogCol, clamp(f, 0.0, 1.0));
}
`;

export const LDR_EPILOGUE = /* glsl */ `
#ifdef LDR_OUTPUT
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  applyGrade(gl_FragColor.rgb);
#endif
`;
