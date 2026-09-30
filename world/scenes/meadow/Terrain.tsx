"use client";

import { useEffect, useMemo } from "react";
import { PlaneGeometry, ShaderMaterial } from "three";
import { FOG_FN, GRADE, LDR_EPILOGUE } from "@/world/atmosphere/shaders";
import type { QualitySettings } from "@/world/quality/tiers";
import { worldUniforms } from "@/world/store/uniforms";
import { terrainHeight } from "@/world/scenes/meadow/terrain";

const terrainVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const terrainFragment = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform float uSunVis;
uniform float uNight;
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
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
void main() {
  float fine = hash12(vWorld.xz * 1.7);
  float streak = hash12(vec2(floor(vWorld.x * 4.0 + vWorld.z * 0.4), floor(vWorld.z * 1.2)));
  float clump = vnoise(vWorld.xz * 0.04);
  vec3 deep = vec3(0.035, 0.14, 0.03);
  vec3 mid = vec3(0.1, 0.34, 0.055);
  vec3 dry = vec3(0.4, 0.42, 0.1);
  vec3 col = mix(deep, mid, 0.35 + 0.65 * clump);
  col = mix(col, dry, smoothstep(0.62, 0.95, fine) * 0.38);
  col *= 0.78 + 0.38 * streak;
  float sheen = sin(uTime * 1.2 + vWorld.x * 0.35 + vWorld.z * 0.22) * 0.5 + 0.5;
  col += vec3(0.035, 0.05, 0.012) * sheen * (1.0 - uNight);
  col = mix(col, col * vec3(0.55, 0.65, 0.85), uNight * 0.45);
  vec3 N = normalize(vNormal);
  float wrap = clamp((dot(N, normalize(uSunDir)) + 0.45) / 1.45, 0.0, 1.0);
  vec3 hemi = mix(uAmbientGround, uAmbientSky, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
  col *= hemi + uSunColor * wrap * uSunVis;
  vec2 shadowCenter = vec2(8.2, -1.5) - uSunDir.xz * 3.0;
  float blob = smoothstep(6.0, 1.2, length(vWorld.xz - shadowCenter));
  col *= mix(1.0, 0.55, blob * uSunVis);
  col = applyFog(col, vWorld, cameraPosition);
  gl_FragColor = vec4(col, 1.0);
  ${LDR_EPILOGUE}
}
`;

export function Terrain({ settings }: { settings: QualitySettings }) {
  const segments = settings.tier === "high" ? 96 : settings.tier === "medium" ? 72 : 48;
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(240, 240, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes.position;
    if (!position) return geo;
    for (let i = 0; i < position.count; i++) {
      position.setY(i, terrainHeight(position.getX(i), position.getZ(i)));
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [segments]);

  const material = useMemo(() => {
    const defines: Record<string, number> = {};
    if (settings.ldrOutput) defines.LDR_OUTPUT = 1;
    return new ShaderMaterial({
      uniforms: {
        uSunDir: worldUniforms.uSunDir,
        uSunColor: worldUniforms.uSunColor,
        uAmbientSky: worldUniforms.uAmbientSky,
        uAmbientGround: worldUniforms.uAmbientGround,
        uSunVis: worldUniforms.uSunVis,
        uNight: worldUniforms.uNight,
        uResolution: worldUniforms.uResolution,
        uAspect: worldUniforms.uAspect,
        uTime: worldUniforms.uTime,
        uFogColor: { value: worldUniforms.uFogColor.value },
        uFogDensity: worldUniforms.uFogDensity,
      },
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      defines,
    });
  }, [settings.ldrOutput]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <mesh geometry={geometry} material={material} />;
}
