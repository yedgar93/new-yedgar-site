"use client";

// Based on https://codepen.io/al-ro/pen/jJJygQ by al-ro,
// rewritten for modern @react-three/fiber + Three.js (r183+)
// Optimised as a non-interactive background effect

import * as THREE from "three";
import {
  useRef,
  useMemo,
  memo,
  Suspense,
  useState,
  useEffect,
  forwardRef,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import Clouds from "./Clouds";
import Stars from "./Stars";
import { easing } from "maath";
import { createNoise2D } from "simplex-noise";
import {
  EffectComposer,
  DepthOfField,
  Bloom,
} from "@react-three/postprocessing";

import BusterSword from "./BusterSword";
/* ------------------------------------------------------------------ */
/*  Constants — declared at top so nothing references before init      */
/* ------------------------------------------------------------------ */

// Module-level color objects — never allocated per-frame
const _dayColor = new THREE.Color(1, 0.78, 0.59);
const _nightColor = new THREE.Color(0.1, 0.1, 0.2);
const _interpColor = new THREE.Color();

export const DAY_NIGHT_PERIOD = 100; // seconds for full cycle
// Cache repeated constant
export const TWO_PI_OVER_DAY_NIGHT = (Math.PI * 2) / DAY_NIGHT_PERIOD;
// Visual offset to lower the sky/horizon independently of lighting
export const SKY_HORIZON_OFFSET = -70;

/* ------------------------------------------------------------------ */
/*  Simplex helpers                                                     */
/* ------------------------------------------------------------------ */

const noise2D = createNoise2D();

function getYPosition(x: number, z: number) {
  let y = 2 * noise2D(x / 50, z / 50);
  y += 4 * noise2D(x / 100, z / 1000);
  y += 0.2 * noise2D(x / 10, z / 10);
  return y;
}

/* ------------------------------------------------------------------ */
/*  Shaders — wind sway is handled entirely in the vertex shader       */
/*  using the time uniform, eliminating all per-frame JS vertex writes */
/* ------------------------------------------------------------------ */

const BLADE_HEIGHT = 2.12;

const getVertexSource = (height: number) => `
precision mediump float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;
attribute vec3 offset;
attribute vec2 uv;
attribute vec4 orientation;
attribute float seed;
attribute float halfRootAngleSin;
attribute float halfRootAngleCos;
attribute float stretch;
attribute float bladeWidth;
uniform float time;
varying vec2 vUv;
varying float frc;
varying float vWind;
varying float vSeed;
varying float vViewDepth;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);} 
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x_=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x_)-0.5;
  vec3 ox=floor(x_+0.5);
  vec3 a0=x_-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}

vec3 rotateVectorByQuaternion(vec3 v,vec4 q){
  return 2.0*cross(q.xyz,v*q.w+cross(q.xyz,v))+v;
}

vec4 slerp(vec4 v0,vec4 v1,float t){
  normalize(v0); normalize(v1);
  float d=dot(v0,v1);
  if(d<0.0){v1=-v1;d=-d;}
  if(d>0.9995){vec4 r=t*(v1-v0)+v0;normalize(r);return r;}
  float t0=acos(d);float th=t0*t;
  float st=sin(th);float st0=sin(t0);
  float s0=cos(th)-d*st/st0;
  float s1=st/st0;
  return s0*v0+s1*v1;
}

void main(){
  frc = position.y / float(${height});

  // Fast per-blade flutter
  float noise = 1.0 - snoise(vec2(time - offset.x/50.0, time - offset.z/50.0));

  // Slow gust wave rolling across the field — patches of grass lean together
  float gust = snoise(vec2(offset.x/30.0 - time*0.18, offset.z/40.0)) * 0.5 + 0.5;
  vWind = gust;

  // Total sway scales with height so roots stay fixed
  float sway = (noise * 0.12 + gust * 0.22) * frc;

  vec4 direction = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);
  direction = slerp(direction, orientation, frc);
  vec3 vPosition = vec3(position.x * bladeWidth, position.y + position.y*stretch, position.z);
  vPosition = rotateVectorByQuaternion(vPosition, direction);
  vPosition = rotateVectorByQuaternion(vPosition, normalize(vec4(sin(sway), 0.0, -sin(sway), cos(sway))));
  vUv = uv;
  vSeed = seed;
  vec4 mvPos = modelViewMatrix * vec4(offset + vPosition, 1.0);
  vViewDepth = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}`;

const fragmentSource = `
precision highp float;
uniform sampler2D map;
uniform sampler2D alphaMap;
varying vec2 vUv;
varying float frc;
varying float vWind;
varying float vViewDepth;
varying float vSeed;
uniform vec3 dayColor;
uniform vec3 nightColor;
uniform float sunNorm;
uniform float dofNear;
uniform float dofFar;
uniform float dofMaxMip;

void main(){
  float alpha = texture2D(alphaMap, vUv).r;
  if(alpha < 0.15) discard;

  // Approximate DOF with a small multi-tap blur whose radius increases with depth.
  float depthFactor = clamp((vViewDepth - dofNear) / (dofFar - dofNear), 0.0, 1.0);
  // Blur radius in UV space (tweak multiplier for stronger/weaker blur)
  float blurRadius = depthFactor * (dofMaxMip * 0.016);
  vec3 baseCol = texture2D(map, vUv).rgb;
  if (blurRadius > 0.0001) {
    vec2 o = vec2(blurRadius, 0.0);
    vec3 c1 = texture2D(map, vUv + o).rgb;
    vec3 c2 = texture2D(map, vUv - o).rgb;
    vec3 c3 = texture2D(map, vUv + vec2(0.0, blurRadius)).rgb;
    vec3 c4 = texture2D(map, vUv - vec2(0.0, blurRadius)).rgb;
    baseCol = (baseCol + c1 + c2 + c3 + c4) / 5.0;
  }
  vec4 texCol = vec4(baseCol, 1.0);

  // Base grass color lerp: dark root → mid green → dry yellow tip
  // Darker, more realistic base palette
  vec3 rootCol  = vec3(0.03, 0.06, 0.015);   // very dark at soil
  vec3 midCol   = vec3(0.09, 0.29, 0.044);    // deeper mid-blade green
  vec3 tipCol   = vec3(0.44, 0.43, 0.17);    // toned-down tip (less saturated)

  // Apply subtle per-blade variation using the per-instance seed.
  // vSeed in [0,1] — use it to slightly vary saturation/brightness and tip hue.
  float seed = clamp(vSeed, 0.0, 1.0);
  // Stronger brightness and hue variance per blade so differences are visible
  float bMul = mix(0.75, 1.30, seed);
  midCol *= bMul;
  // Push some blades greener, others slightly more yellow/brown depending on seed
  midCol = mix(midCol, midCol + vec3(0.14, 0.08, -0.04), seed);
  // Stronger tip shift toward yellow/brown for higher seeds
  vec3 tipShift = vec3(0.72, 0.54, 0.08);
  tipCol = mix(tipCol, tipShift, seed * 1.2);

  vec3 grassCol = mix(rootCol, midCol, smoothstep(0.0, 0.5, frc));
  grassCol      = mix(grassCol, tipCol, smoothstep(0.5, 1.0, frc));

  // Blend with diffuse texture — compute sharp and blurred versions, then mix based on depth
  vec3 texSharp = texture2D(map, vUv).rgb;
  vec3 texBlur = texCol.rgb; // baseCol already blurred when depthFactor dictated
  // Reduce texture influence to avoid overly bright blades from the diffuse map
  vec3 colSharp = mix(grassCol, texSharp, 0.22);
  vec3 colBlur = mix(grassCol, texBlur, 0.22);
  float blurInfluence = clamp(depthFactor * 1.5, 0.0, 1.0);
  vec3 col = mix(colSharp, colBlur, blurInfluence);

  // Ambient occlusion — darken base independent of texture
  float ao = smoothstep(0.0, 0.3, frc);
  // Ambient multiplier lowered to avoid washed-out brightness (slightly darker)
  float ambient = mix(0.04, 0.48, sunNorm);
  col *= ambient * (0.28 + 0.55 * ao);

  // Wind-driven tip brightening — reduced so tips aren't overly bright
  col += vec3(0.004, 0.005, 0.001) * vWind * smoothstep(0.6, 1.0, frc) * sunNorm;

  // Simple distance fog — blend to a pale sky color at far blades
  float fogFactor = smoothstep(0.0, 1.0, vUv.y * 0.3);
  vec3 fogColor = vec3(0.78, 0.88, 0.95);
  col = mix(col, fogColor, fogFactor * 0.12);

    // Night adjustments: keep blades colorful and only slightly darker when sun is down
    // nightFactor: 0 at day, 1 at full night
    float nightFactor = clamp(1.0 - sunNorm, 0.0, 1.0);
    // Gentle global darkening at night (up to ~15% darker)
    col *= mix(1.0, 0.82, nightFactor * 0.9);
    // Subtle dark-green tint to keep blades green rather than grey
    vec3 grassNightTint = vec3(0.86, 0.92, 0.78);
    col = mix(col, col * grassNightTint, nightFactor * 0.28);

    // Final exposure tweak to darken overall look slightly
    col *= 0.82;

  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ */
/*  Attribute data (computed once at module load)                      */
/* ------------------------------------------------------------------ */

function multiplyQuaternions(q1: THREE.Vector4, q2: THREE.Vector4) {
  // Compute into q1 to avoid allocating a new Vector4 per multiplication
  const x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;
  const y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;
  const z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;
  const w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;
  q1.set(x, y, z, w);
  return q1;
}

function getAttributeData(instances: number, width: number) {
  const offsets: number[] = [];
  const orientations: number[] = [];
  const stretches: number[] = [];
  const widths: number[] = [];
  const halfRootAngleSin: number[] = [];
  const halfRootAngleCos: number[] = [];
  const seeds: number[] = [];

  let quaternion_0 = new THREE.Vector4();
  let quaternion_1 = new THREE.Vector4();
  const axis = new THREE.Vector3();
  const min = -0.25;
  const max = 0.25;

  for (let i = 0; i < instances; i++) {
    const offsetX = Math.random() * width - width / 2;
    const offsetZ = Math.random() * width - width / 2;
    const offsetY = getYPosition(offsetX, offsetZ);
    offsets.push(offsetX, offsetY, offsetZ);

    let angle = Math.PI - Math.random() * (2 * Math.PI);
    halfRootAngleSin.push(Math.sin(0.5 * angle));
    halfRootAngleCos.push(Math.cos(0.5 * angle));

    axis.set(0, 1, 0);
    quaternion_0
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();

    angle = Math.random() * (max - min) + min;
    axis.set(1, 0, 0);
    quaternion_1
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();
    multiplyQuaternions(quaternion_0, quaternion_1);

    angle = Math.random() * (max - min) + min;
    axis.set(0, 0, 1);
    quaternion_1
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();
    multiplyQuaternions(quaternion_0, quaternion_1);

    orientations.push(
      quaternion_0.x,
      quaternion_0.y,
      quaternion_0.z,
      quaternion_0.w,
    );

    // Give greater variance to blade lengths: create a mix of very short and very long
    stretches.push(
      i < instances / 3 ? Math.random() * 3.0 : Math.random() * 2.2 + 0.1,
    );
    // Per-instance width multiplier with wider spread (0.25 -> very thin, 2.2 -> very wide)
    widths.push(Math.random() * 1.95 + 0.25);
    // Per-instance seed for subtle color variation
    seeds.push(Math.random());
  }

  return {
    offsets: new Float32Array(offsets),
    orientations: new Float32Array(orientations),
    stretches: new Float32Array(stretches),
    widths: new Float32Array(widths),
    halfRootAngleCos: new Float32Array(halfRootAngleCos),
    halfRootAngleSin: new Float32Array(halfRootAngleSin),
    seeds: new Float32Array(seeds),
  };
}

/* ------------------------------------------------------------------ */
/*  Grass mesh                                                         */
/* ------------------------------------------------------------------ */

const BLADE_WIDTH = 0.049;
const BLADE_JOINTS = 10;
const INSTANCES = 44000;
const FIELD_WIDTH = 111;

const Grass = memo(
  forwardRef(function Grass(_props, ref) {
    const materialRef = useRef<THREE.RawShaderMaterial>(null);

    const [texture, alphaMap] = useLoader(THREE.TextureLoader, [
      "/blade_diffuse.jpg",
      "/blade_alpha.jpg",
    ]);

    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    alphaMap.generateMipmaps = true;
    alphaMap.anisotropy = 4;
    alphaMap.colorSpace = THREE.SRGBColorSpace;

    const attributeData = useMemo(
      () => getAttributeData(INSTANCES, FIELD_WIDTH),
      [],
    );

    const baseGeometry = useMemo(() => {
      const geo = new THREE.PlaneGeometry(
        BLADE_WIDTH,
        BLADE_HEIGHT,
        1,
        BLADE_JOINTS,
      );
      geo.translate(0, BLADE_HEIGHT / 2, 0);
      return geo;
    }, []);

    const groundGeo = useMemo(() => {
      const geo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_WIDTH, 32, 32);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, getYPosition(x, z));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      return geo;
    }, []);

    const uniforms = useMemo(
      () => ({
        map: { value: texture },
        alphaMap: { value: alphaMap },
        time: { value: 0 },
        dayColor: { value: _dayColor },
        nightColor: { value: _nightColor },
        sunNorm: { value: 1 }, // Default to day
        dofNear: { value: 9.0 },
        dofFar: { value: 140.0 },
        dofMaxMip: { value: 15.0 },
      }),
      [texture, alphaMap],
    );

    // Wind sway is now entirely in the vertex shader — no vertex buffer writes here
    useFrame(({ clock }) => {
      if (materialRef.current) {
        materialRef.current.uniforms.time.value = clock.elapsedTime / 4;
      }
    });

    // Forward internal material ref to parent if a ref was provided
    useEffect(() => {
      if (!ref) return;
      try {
        if (typeof ref === "function") {
          ref(materialRef.current);
        } else {
          (ref as any).current = materialRef.current;
        }
      } catch (e) {
        // ignore
      }
    }, [ref]); // materialRef.current intentionally omitted — refs are stable, .current is not a dep

    // Update uniforms from SunContext so this component does not force the
    // parent to re-render when sun changes. This keeps the canvas subtree
    // reactive while the surrounding DOM stays stable.
    const { sunNorm } = useContext(SunContext);
    useEffect(() => {
      const m = materialRef.current;
      if (!m) return;
      const eps = 1e-3;
      try {
        if (
          m.uniforms &&
          Math.abs((m.uniforms.sunNorm?.value ?? 0) - sunNorm) > eps
        ) {
          m.uniforms.sunNorm.value = sunNorm;
        }
        if (m.uniforms && m.uniforms.dayColor)
          m.uniforms.dayColor.value.copy(_dayColor);
        if (m.uniforms && m.uniforms.nightColor)
          m.uniforms.nightColor.value.copy(_nightColor);
      } catch (e) {
        // ignore if material not yet attached
      }
    }, [sunNorm]);

    return (
      <group>
        <mesh>
          <instancedBufferGeometry
            index={baseGeometry.index}
            attributes-position={baseGeometry.attributes.position}
            attributes-uv={baseGeometry.attributes.uv}
          >
            <instancedBufferAttribute
              attach="attributes-offset"
              args={[attributeData.offsets, 3]}
            />
            <instancedBufferAttribute
              attach="attributes-orientation"
              args={[attributeData.orientations, 4]}
            />
            <instancedBufferAttribute
              attach="attributes-stretch"
              args={[attributeData.stretches, 1]}
            />
            <instancedBufferAttribute
              attach="attributes-bladeWidth"
              args={[attributeData.widths, 1]}
            />
            <instancedBufferAttribute
              attach="attributes-halfRootAngleSin"
              args={[attributeData.halfRootAngleSin, 1]}
            />
            <instancedBufferAttribute
              attach="attributes-halfRootAngleCos"
              args={[attributeData.halfRootAngleCos, 1]}
            />
            <instancedBufferAttribute
              attach="attributes-seed"
              args={[attributeData.seeds, 1]}
            />
          </instancedBufferGeometry>
          <rawShaderMaterial
            ref={materialRef}
            uniforms={uniforms}
            vertexShader={getVertexSource(BLADE_HEIGHT)}
            fragmentShader={fragmentSource}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={groundGeo}>
          <meshStandardMaterial color="#2a521b" />
        </mesh>
      </group>
    );
  }),
);

/* ------------------------------------------------------------------ */
/*  Camera Controller                                                  */
/* ------------------------------------------------------------------ */

function CameraController() {
  const ready = useRef(false);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.06);
    const target: [number, number, number] = [
      4 + state.pointer.x * 0.25,
      8 + state.pointer.y * 0.1,
      25,
    ];
    if (!ready.current) {
      state.camera.position.set(...target);
      state.camera.lookAt(0, 0, -20);
      ready.current = true;
    } else {
      easing.damp3(state.camera.position, target, 0.3, d);
      state.camera.lookAt(0, 10, -20);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Animated sky + light                                               */
/* ------------------------------------------------------------------ */

function AnimatedEnvironment({}: {}) {
  const { setSunNorm } = useContext(SunContext);
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);
  const sunLightRef = useRef<any>(null);
  const lastSunY = useRef<number>(9999);
  const lastSunNorm = useRef<number>(9999);
  // Ref to track the last sunNorm value dispatched to React state,
  // preventing setState from being called every frame and causing
  // "Maximum update depth exceeded".
  const lastDispatchedSunNorm = useRef<number>(-1);
  const sunPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const MIDNIGHT_ANGLE = 1.5 * Math.PI;

  useFrame(({ clock }) => {
    const forceNight =
      typeof window !== "undefined" &&
      window.location.search.toLowerCase().includes("forcenight=1");
    const t = forceNight
      ? MIDNIGHT_ANGLE
      : clock.elapsedTime * TWO_PI_OVER_DAY_NIGHT;
    const sunY = Math.sin(t) * 185;

    // Normalised sun intensity for shading
    const newSunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));

    // Always update light intensity (cheap) — use milder intensities to avoid overexposure
    if (lightRef.current) {
      const baseIntensity = 0.001;
      const peakIntensity = 0.4;
      const horizonBoost = Math.max(0, Math.sin(t) * 0.2);
      lightRef.current.intensity =
        baseIntensity +
        newSunNorm * (peakIntensity - baseIntensity) +
        horizonBoost;
      // Reuse module-level objects — no allocation
      _interpColor.copy(_dayColor).lerp(_nightColor, 1 - newSunNorm);
      lightRef.current.color.copy(_interpColor);
    }

    // Drive the directional sun light so the sword picks up real sun reflections.
    // sunX/sunY match the Sky shader's sun arc.
    if (sunLightRef.current) {
      const sunX = Math.cos(t) * 1300;
      const sunY2 = Math.sin(t) * 185;
      sunLightRef.current.position.set(
        sunX * 0.01,
        Math.max(0.1, sunY2 * 0.05),
        -10,
      );
      // Warm orange near horizon, white at noon, dim at night
      const horizonFactor = Math.max(0, 1 - Math.abs(newSunNorm - 0.25) / 0.25);
      _interpColor.setRGB(
        1.0,
        THREE.MathUtils.lerp(0.55, 1.0, newSunNorm),
        THREE.MathUtils.lerp(0.15, 0.95, newSunNorm),
      );
      sunLightRef.current.color.copy(_interpColor);
      // Intensity: dim at night, bright glint near horizon (sunrise/sunset), full at noon
      const horizonGlint =
        Math.max(0, Math.sin(t)) < 0.15 ? Math.max(0, Math.sin(t)) * 6 : 0;
      sunLightRef.current.intensity = newSunNorm * 2.5 + horizonGlint;
    }

    // Epsilon guards: skip expensive uniform writes when values haven't changed
    if (
      Math.abs(sunY - lastSunY.current) < 0.05 &&
      Math.abs(newSunNorm - lastSunNorm.current) < 0.005
    )
      return;

    lastSunY.current = sunY;
    lastSunNorm.current = newSunNorm;

    // Only call setSunNorm (React setState) when the value has changed
    // meaningfully. Calling setState every frame causes "Maximum update depth
    // exceeded" because each state update triggers a re-render which triggers
    // another frame callback before the previous render completes.
    if (Math.abs(newSunNorm - lastDispatchedSunNorm.current) > 0.01) {
      lastDispatchedSunNorm.current = newSunNorm;
      setSunNorm(newSunNorm);
    }

    const sunX = Math.cos(t) * 1300;
    const sunZ = -1500;
    // Apply visual-only horizon offset so sky moves without changing lighting
    sunPosRef.current.set(sunX, sunY + SKY_HORIZON_OFFSET, sunZ);

    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.copy(
        sunPosRef.current,
      );
    }
    if (skyRef.current?.material?.uniforms) {
      const u = skyRef.current.material.uniforms;
      if (u.mieDirectionalG) u.mieDirectionalG.value = 0.05 + newSunNorm * 0.42;
      if (u.rayleigh) u.rayleigh.value = 0.98 + (1 - newSunNorm) * 1.1;
      if (u.mieCoefficient)
        u.mieCoefficient.value = 0.0065 + (1 - newSunNorm) * 0.025;
      if (u.turbidity) {
        const sunEdge = 1 - Math.min(1, Math.max(0, sunY / 90));
        u.turbidity.value = 1.0 + sunEdge * 2 + (1 - newSunNorm) * 6;
      }
    }
  });

  return (
    <>
      <ambientLight ref={lightRef} intensity={0.55} />
      {/* Directional sun — drives metallic reflections and glints on the sword */}
      <directionalLight
        ref={sunLightRef}
        intensity={0}
        castShadow={false}
        position={[0, 5, -10]}
      />
      <Sky
        ref={skyRef}
        sunPosition={[0, 100 + SKY_HORIZON_OFFSET, -4000]}
        turbidity={0.91}
        rayleigh={0.375}
        mieCoefficient={0.01}
        mieDirectionalG={0.1}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Postprocessing Effects using @react-three/postprocessing            */
/* ------------------------------------------------------------------ */

function Effects() {
  const { camera, size, gl } = useThree();

  // Tune these defaults to get a camera-like look; we'll choose conservative defaults
  const focusDistance = 25; // world units
  const focalLength = 40; // mm-ish scale used by the lib
  const bokehScale = 2.5; // blur strength

  // Do not manipulate renderer color/toneMapping here — leave renderer defaults unchanged.

  const composerRef = useRef<any>(null);

  useEffect(() => {
    const comp = composerRef.current;
    if (!comp) return;
    // Try to access the underlying composer render target texture
    const maybeComposer = comp.composer || comp;
    const rt =
      maybeComposer?.readBuffer?.texture ||
      maybeComposer?.renderTarget?.texture ||
      maybeComposer?.writeBuffer?.texture;
    if (!rt) return;
    // Set texture encoding/colorSpace safely using bracket access to avoid static export checks
    const sRGBEnc = (THREE as any)["sRGBEncoding"];
    const sRGBCS =
      (THREE as any)["SRGBColorSpace"] || (THREE as any)["sRGBColorSpace"];
    try {
      if (sRGBEnc !== undefined) rt.encoding = sRGBEnc;
      if (sRGBCS !== undefined) rt.colorSpace = sRGBCS;
    } catch (e) {
      // ignore if runtime doesn't allow these properties
    }
  }, [size]);

  return (
    <EffectComposer
      ref={composerRef}
      multisampling={0}
      enableNormalPass={false}
    >
      <DepthOfField
        focusDistance={focusDistance}
        focalLength={focalLength}
        bokehScale={bokehScale}
        height={size.height}
      />
      <Bloom
        intensity={0.03}
        kernelSize={4}
        luminanceThreshold={0.97}
        luminanceSmoothing={0.23}
      />
    </EffectComposer>
  );
}

// Render objects on layer 1 directly to the screen after postprocessing
// so they are not affected by the DepthOfField / composer passes.
function RenderLayer1AfterComposer() {
  const { gl, scene, camera } = useThree();

  useFrame(() => {
    // Render only layer 1 (stars). Keep renderer autoClear state.
    const prevAutoClear = gl.autoClear;
    gl.autoClear = false;

    // First render layer 0 into the depth buffer only so layer-1
    // objects (stars) are correctly occluded by the main scene (grass,
    // sword). Disable color writes for this pass so we don't overwrite
    // the composited color buffer.
    try {
      const glCtx = (gl as any).getContext
        ? (gl as any).getContext()
        : (gl as any).gl;
      if (glCtx && typeof glCtx.colorMask === "function") {
        const prevColorMask = glCtx.getParameter(glCtx.COLOR_WRITEMASK as any);
        glCtx.colorMask(false, false, false, false);
        camera.layers.set(0);
        gl.render(scene, camera);
        glCtx.colorMask(
          prevColorMask[0],
          prevColorMask[1],
          prevColorMask[2],
          prevColorMask[3],
        );
      } else {
        // Fallback: render normally into depth (may also write color).
        camera.layers.set(0);
        gl.render(scene, camera);
      }
    } catch (e) {
      // If anything goes wrong interacting with the raw GL context,
      // fall back to rendering layer 0 normally so we at least populate
      // the depth buffer.
      camera.layers.set(0);
      gl.render(scene, camera);
    }

    // Now render layer 1 (stars + any layer-1 objects). Depth buffer now
    // contains scene geometry so stars will be occluded where appropriate.
    camera.layers.set(1);
    gl.render(scene, camera);
    camera.layers.set(0);

    gl.autoClear = prevAutoClear;
  }, 1000);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Sky overlay mesh (inside scene) — sits behind grass but in front of sky  */
/* ------------------------------------------------------------------ */

function SkyOverlay({}: {}) {
  const { sunNorm } = useContext(SunContext);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  // large plane that sits far behind the scene but in front of the sky dome
  // size is large to cover the view for all FOVs
  const size = 6000;

  useFrame(() => {
    if (!matRef.current) return;
    // Night opacity ramps from 0 (day) to ~0.95 (full night)
    const nightOpacity = Math.min(0.95, (1 - sunNorm) * 0.95);
    matRef.current.opacity = nightOpacity;
  });
  return (
    // Render behind the grass (closer to the sky dome). Enable depth testing so grass occludes it.
    <mesh ref={meshRef} position={[0, 0, -1500]} renderOrder={0}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        ref={matRef}
        // Dark blue tint used to subtly darken the sky at night
        color={new THREE.Color(0.01, 0.02, 0.04)}
        transparent={true}
        opacity={0}
        depthWrite={false}
        depthTest={true}
        blending={THREE.MultiplyBlending}
        premultipliedAlpha={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Overlay controller moved to module scope to avoid remounts         */
/* ------------------------------------------------------------------ */

function OverlayController({
  setOverlayOpacity,
  setMidnightOpacity,
}: {
  setOverlayOpacity: (n: number) => void;
  setMidnightOpacity: (n: number) => void;
}) {
  const lastSunNorm = useRef<number>(9999);
  const MIDNIGHT_ANGLE = 1.5 * Math.PI;
  useFrame(({ clock }) => {
    const forceNight =
      typeof window !== "undefined" &&
      window.location.search.toLowerCase().includes("forcenight=1");
    const t = forceNight
      ? MIDNIGHT_ANGLE
      : clock.elapsedTime * TWO_PI_OVER_DAY_NIGHT;
    const sunY = Math.sin(t) * 180 - 20;
    const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));

    // Avoid frequent state updates when sunNorm hasn't changed meaningfully
    if (Math.abs(sunNorm - lastSunNorm.current) < 0.005) return;
    lastSunNorm.current = sunNorm;

    // Update overlay opacity based on sunNorm
    setOverlayOpacity(1 - sunNorm);
    // Increase max overlay so night becomes visibly darker (closer to true night)
    const maxOpacity = 0.5;
    const minOpacity = 0;
    const opacity =
      sunNorm < 0.18
        ? maxOpacity
        : Math.max(minOpacity, (1 - sunNorm) * maxOpacity);
    setMidnightOpacity(opacity);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Full-scene postprocess DOF pass                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Exported background component                                      */
/* ------------------------------------------------------------------ */

import { useContext } from "react";
import { SunContext } from "./SunContext";

export default function GrassBackground({
  progress = 0,
}: {
  progress?: number;
}) {
  // Do not consume `sunNorm` here — consuming it would subscribe this
  // component to context updates and cause the Canvas children to be
  // remounted on every sun change. Children inside the Canvas will read
  // the context themselves.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsVisible(e.isIntersecting)),

      { threshold: 0.01 },
    );

    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Pause rendering when tab is hidden
  const [isTabVisible, setIsTabVisible] = useState(true);
  useEffect(() => {
    const handle = () => setIsTabVisible(!document.hidden);
    handle();
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(t);
  }, []);

  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [midnightOpacity, setMidnightOpacity] = useState(0);

  // Material ref (kept to allow future access if needed)
  const grassMaterialRef = useRef<THREE.RawShaderMaterial | null>(null);
  // memoize style objects to avoid allocating them each render
  const outerStyle = useMemo(
    () => ({ opacity: isLoaded ? 1 : 0, transition: "opacity 1s ease-in-out" }),
    [isLoaded],
  );

  const skyStyle = useMemo(
    () => ({
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      zIndex: -100,
      pointerEvents: "none",
      background: "linear-gradient(to bottom, #87ceeb 0%, #b0e0e6 100%)",
    }),
    [],
  );

  const midnightStyle = useMemo(
    () => ({
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      zIndex: 1,
      pointerEvents: "none",
      // Darker, near-opaque midnight overlay to ensure the sky reads as night
      background: "rgba(6, 8, 20, 1)",
      mixBlendMode: "multiply",
      transition: "opacity 8s ease-in-out",
    }),
    [],
  );

  const containerStyle = useMemo(
    () => ({
      position: "absolute",
      inset: 0,
      zIndex: 0,
      width: "100vw",
      height: "100vh",
      pointerEvents: "auto",
    }),
    [],
  );

  const canvasStyle = useMemo(
    () => ({ position: "absolute", inset: 0, zIndex: 0 }),
    [],
  );

  return (
    <div
      style={{
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 1s ease-in-out",
      }}
    >
      {/* Static sky gradient — no JS interval needed, CSS handles it */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -100,
          pointerEvents: "none",
          background: "linear-gradient(to bottom, #87ceeb 0%, #b0e0e6 100%)",
        }}
      />

      {/* Stars: render in-scene (inside the main Canvas) so they appear over the Sky dome */}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1, // Ensure it is above the grass, sky, and sun but below the nav and page content
          pointerEvents: "none",
          background: "rgba(6, 8, 20, 1)", // Dark midnight blue
          opacity: midnightOpacity,
          mixBlendMode: "multiply", // Ensure proper blending with the background
          transition: "opacity 6s ease-in-out", // Smooth transition for fading
        }}
      />

      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "auto",
        }}
      >
        <Canvas
          dpr={[1, 1.125]}
          frameloop={isVisible && isTabVisible ? "always" : "demand"}
          gl={{ powerPreference: "low-power", antialias: true }}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        >
          <Suspense fallback={null}>
            <AnimatedEnvironment />
            <Clouds />
            <Stars />
            <SkyOverlay />
            <OverlayController
              setOverlayOpacity={setOverlayOpacity}
              setMidnightOpacity={setMidnightOpacity}
            />
            <CameraController />
            <Grass ref={grassMaterialRef as any} />
            <BusterSword />
            <Effects />
            <RenderLayer1AfterComposer />
          </Suspense>
        </Canvas>
      </div>
      {/* overlay Canvas removed — stars render inside the main Canvas on layer 1 */}
      {/* Postprocessing controls removed — using DepthOfField effect */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 2,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 40% 55% at 50% 42%, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)",
        }}
      />
    </div>
  );
}
