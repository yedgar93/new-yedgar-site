"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect, useContext } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { TWO_PI_OVER_DAY_NIGHT } from "./GrassBackground";
import { SunContext } from "./SunContext";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STAR_COUNT = 4200;
const SKY_RADIUS = 1000;
const MIN_ELEVATION_SIN = 0.08; // hide stars right at / below horizon

export interface StarSettings {
  twinkleA?: number; // primary twinkle amplitude
  twinkleB?: number; // secondary twinkle amplitude
  wobbleAmp?: number; // radial wobble amplitude (world units)
  wobbleFreq?: number; // wobble frequency multiplier
  sizeScale?: number; // global size multiplier
  brightnessScale?: number; // multiplier applied to per-star brightness
  fadeLerp?: number; // opacity lerp factor per frame
  // Stars are FULLY VISIBLE when sunNorm <= fadeFullyOn
  // Stars START fading out when sunNorm >= fadeLow
  // Stars are FULLY GONE   when sunNorm >= fadeHigh
  fadeFullyOn?: number; // sunNorm below which stars are at full opacity
  fadeLow?: number; // sunNorm at which fade-out begins (sunrise / near-sunset)
  fadeHigh?: number; // sunNorm at which stars are completely gone
}

export const defaultStarSettings: Required<StarSettings> = {
  twinkleA: 0.28,
  twinkleB: 0.12,
  wobbleAmp: 0.002,
  wobbleFreq: 0.35,
  sizeScale: 0.95,
  brightnessScale: 0.5,
  fadeLerp: 0.001, // slower lerp = smooth fade over many frames
  // Thresholds: sunNorm 0 = full night, 1 = full day.
  // Stars fully visible below 0.05 (deep night).
  // Begin fading at 0.08 (first hint of dawn / last of dusk).
  // Completely gone by 0.18 (well before sun is up).
  fadeFullyOn: 0.05,
  fadeLow: 0.08,
  fadeHigh: 0.24,
};

/* ------------------------------------------------------------------ */
/*  Static data — generated once at module load                        */
/* ------------------------------------------------------------------ */

function buildStarData(count: number, radius: number) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const bris = new Float32Array(count);

  const palette = [
    [0.72, 0.8, 1.0],
    [0.88, 0.92, 1.0],
    [1.0, 0.97, 0.9],
    [1.0, 0.92, 0.72],
    [1.0, 0.76, 0.48],
  ];
  const cumW = [0.14, 0.42, 0.7, 0.9, 1.0];

  let written = 0;
  while (written < count) {
    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;
    const w = Math.random() * 2 - 1;
    const len = Math.sqrt(u * u + v * v + w * w);
    if (len === 0 || len > 1) continue;
    const nx = u / len,
      ny = v / len,
      nz = w / len;
    if (ny < MIN_ELEVATION_SIN) continue;

    positions[written * 3 + 0] = nx * radius;
    positions[written * 3 + 1] = ny * radius;
    positions[written * 3 + 2] = nz * radius;

    const r = Math.random();
    let size: number;
    if (r < 0.7) size = Math.random() * 0.55 + 0.25;
    else if (r < 0.92) size = Math.random() * 0.8 + 0.7;
    else size = Math.random() * 1.6 + 1.4;
    sizes[written] = size;

    const rr = Math.random();
    const ci = cumW.findIndex((c) => rr <= c);
    const [cr, cg, cb] = palette[Math.max(0, ci)];
    const bri = 0.7 + Math.random() * 0.3;
    colors[written * 3 + 0] = cr * bri;
    colors[written * 3 + 1] = cg * bri;
    colors[written * 3 + 2] = cb * bri;

    phases[written] = Math.random() * Math.PI * 2;
    bris[written] = 0.72 + Math.random() * 0.56;

    written++;
  }

  return { positions, sizes, colors, phases, bris };
}

const starData = buildStarData(STAR_COUNT, SKY_RADIUS);

/* ------------------------------------------------------------------ */
/*  Shaders                                                             */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
attribute float size;
attribute vec3 color;
attribute float phase;
attribute float brightness;
varying vec3 vColor;
varying float vPhase;
varying float vBrightness;
uniform float time;
uniform vec3 cameraPos;
uniform float uTwinkleA;
uniform float uTwinkleB;
uniform float uWobbleAmp;
uniform float uWobbleFreq;
uniform float uSizeScale;

void main() {
  vColor = color;
  vPhase = phase;
  vBrightness = brightness;

  vec3 worldPos = position + cameraPos;

  vec3 dir = normalize(worldPos);
  float wobble = uWobbleAmp * sin(time * uWobbleFreq + phase * 1.3);
  worldPos += dir * wobble;

  vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);

  float twinkle = 1.0 + (uTwinkleA * sin(time * 2.8 + phase) + uTwinkleB * sin(time * 5.1 + phase * 1.7)) * vBrightness;
  float ps = size * uSizeScale * twinkle * (420.0 / -mvPos.z);
  ps = max(ps, 1.6);
  gl_PointSize = ps;
  gl_Position  = projectionMatrix * mvPos;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vPhase;
varying float vBrightness;
uniform float opacity;
uniform float time;
uniform float uBrightnessScale;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r  = length(uv) * 2.0;

  float core = exp(-r * r * 10.0);
  float halo = exp(-r * r *  2.8) * 0.28;
  float disc = core + halo;

  float flicker = 1.0 + (0.18 * sin(time * 3.3 + vPhase * 2.1) + 0.08 * sin(time * 7.7 + vPhase)) * vBrightness;

  float b = vBrightness * uBrightnessScale;
  float alpha = disc * flicker * opacity * b;
  if (alpha < 0.002) discard;
  vec3 col = mix(vColor, vec3(1.0), core * 0.45) * (0.9 + 0.3 * b);
  gl_FragColor = vec4(col, alpha);
}
`;

/* ------------------------------------------------------------------ */
/*  Inner scene                                                         */
/* ------------------------------------------------------------------ */

function StarField({
  sunNorm,
  settings,
}: {
  sunNorm: number;
  settings?: StarSettings;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const opacityRef = useRef(0);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(() => {
    if (pointsRef.current) pointsRef.current.layers.set(1);
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(starData.positions, 3),
    );
    geo.setAttribute("size", new THREE.BufferAttribute(starData.sizes, 1));
    geo.setAttribute("color", new THREE.BufferAttribute(starData.colors, 3));
    geo.setAttribute("phase", new THREE.BufferAttribute(starData.phases, 1));
    geo.setAttribute(
      "brightness",
      new THREE.BufferAttribute((starData as any).bris, 1),
    );
    return geo;
  }, []);

  const merged = Object.assign({}, defaultStarSettings, settings || {});

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      opacity: { value: 0 },
      cameraPos: { value: new THREE.Vector3() },
      uTwinkleA: { value: merged.twinkleA },
      uTwinkleB: { value: merged.twinkleB },
      uWobbleAmp: { value: merged.wobbleAmp },
      uWobbleFreq: { value: merged.wobbleFreq },
      uSizeScale: { value: merged.sizeScale * 3.5 },
      uBrightnessScale: { value: merged.brightnessScale * 2.5 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock, camera }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    if (!u) return;

    u.time.value = clock.elapsedTime;
    u.cameraPos.value.copy(camera.position);

    // Keep on layer 1 defensively
    if (pointsRef.current && (pointsRef.current.layers.mask & 2) === 0)
      pointsRef.current.layers.set(1);

    // --- URL debug overrides ---
    const forcedNight =
      typeof window !== "undefined" &&
      window.location.search.includes("forceNight=1");
    const forcedDay =
      typeof window !== "undefined" &&
      window.location.search.includes("forceDay=1");
    const debugVis =
      typeof window !== "undefined" &&
      window.location.search.includes("starsDebug=1");
    const localSun = forcedNight ? 0 : forcedDay ? 1 : sunNorm;

    // --- Compute target opacity (single source of truth) ---
    // Stars are fully on  when localSun <= fadeFullyOn
    // Stars are fully off when localSun >= fadeHigh
    // Smooth fade between fadeLow and fadeHigh
    let target: number;
    if (localSun <= merged.fadeFullyOn) {
      target = 1;
    } else if (localSun >= merged.fadeHigh) {
      target = 0;
    } else {
      // smoothstep from 1→0 as sun rises from fadeLow to fadeHigh
      target =
        1 -
        THREE.MathUtils.smoothstep(localSun, merged.fadeLow, merged.fadeHigh);
    }

    // Lerp toward target; snap when very close to avoid infinite creeping
    opacityRef.current += (target - opacityRef.current) * merged.fadeLerp;
    if (Math.abs(target - opacityRef.current) < 0.002)
      opacityRef.current = target;

    // --- Write uniforms (single write per frame) ---
    u.opacity.value = debugVis ? 1 : opacityRef.current;

    // Scale size/brightness with night factor so stars shrink away cleanly
    const nightFactor = opacityRef.current; // 0 = day, 1 = night

    // Compute a time-of-night curve that peaks at local midnight.
    // Use the global cycle clock to get a consistent phase in [0, 2PI).
    const angle =
      (clock.elapsedTime % ((2 * Math.PI) / TWO_PI_OVER_DAY_NIGHT)) *
      TWO_PI_OVER_DAY_NIGHT;
    const midnightAngle = 1.5 * Math.PI; // 3PI/2 — where sun is lowest in the sky
    // cosine-based curve: 0 at noon, 1 at midnight, smooth in-between
    const timeCurve = (1 + Math.cos(angle - midnightAngle)) * 0.5;

    // brightness boost multiplier peaks at `brightnessBoostPeak` at midnight
    const brightnessBoostPeak = 0.8; // 0.8 = +80% at peak; tweakable
    const timeBrightnessMultiplier = 1 + brightnessBoostPeak * timeCurve;

    u.uSizeScale.value = THREE.MathUtils.lerp(
      merged.sizeScale * 0.1,
      merged.sizeScale * 3.5,
      nightFactor,
    );

    // Base brightness scaled by nightFactor, then modulated by time-of-night multiplier
    const baseBrightness = THREE.MathUtils.lerp(
      merged.brightnessScale * 0.05,
      merged.brightnessScale * 2.5,
      nightFactor,
    );
    u.uBrightnessScale.value = baseBrightness * timeBrightnessMultiplier;

    if (debugVis) {
      u.uSizeScale.value = merged.sizeScale * 3.5;
      u.uBrightnessScale.value = merged.brightnessScale * 2.5;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported component                                                  */
/* ------------------------------------------------------------------ */

export interface StarsProps {
  /** 0 = full night, 1 = full day — from AnimatedEnvironment */
  sunNorm?: number;
  settings?: StarSettings;
}

export default function Stars({ sunNorm, settings }: StarsProps) {
  const ctx = useContext(SunContext);
  const useSun = sunNorm ?? ctx.sunNorm ?? 0;
  return <StarField sunNorm={useSun} settings={settings} />;
}
