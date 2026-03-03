"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect, useContext } from "react";
import { useFrame } from "@react-three/fiber";
import { SunContext } from "./SunContext";

export default function Clouds({
  speed = 0.035,
  coverage = 0.35,
  altitude = 400,
  scale = 16,
  cloudBottom = 0.67,
  layerSpeed1 = 4,
  layerSpeed2 = 2,
  layerSpeed3 = 0.15,
  bigScale = 30,
  bigStrength = 0.18,
  bigCoverage = 0.12,
  opacity = 0.55,
  sunNorm = 1.0,
  sunUv = [0.5, 0.5],
  sunDot = 1.0,
}: {
  speed?: number;
  coverage?: number;
  altitude?: number;
  scale?: number;
  cloudBottom?: number;
  layerSpeed1?: number;
  layerSpeed2?: number;
  layerSpeed3?: number;
  bigScale?: number;
  bigStrength?: number;
  bigCoverage?: number;
  sunNorm?: number;
  sunUv?: [number, number];
  sunDot?: number;
  opacity?: number;
}) {
  const ctx = useContext(SunContext);
  // useSunNorm reads from context (updates every cycle) — sunNorm prop is just a fallback
  const useSunNorm = ctx?.sunNorm ?? sunNorm;

  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const lastTimeRef = useRef<number>(0);
  const camDir = useRef(new THREE.Vector3());
  const targetPos = useRef(new THREE.Vector3());
  const sunUvRef = useRef(new THREE.Vector2(0.5, 0.5));

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 1, 1), []);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      speed: { value: speed },
      coverage: { value: coverage },
      cloudColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
      scale: { value: scale },
      opacity: { value: opacity },
      sunNorm: { value: useSunNorm },
      sunUv: { value: sunUvRef.current.clone() },
      sunDot: { value: 1.0 },
      cloudBottom: { value: cloudBottom },
      aspect: { value: 1.0 },
      layerSpeed1: { value: layerSpeed1 },
      layerSpeed2: { value: layerSpeed2 },
      layerSpeed3: { value: layerSpeed3 },
      bigScale: { value: bigScale },
      bigStrength: { value: bigStrength },
      bigCoverage: { value: bigCoverage },
    }),
    [speed, coverage, scale],
  );

  // FIX: dependency was `sunNorm` (the prop, always 1.0 when called as <Clouds />)
  // but the value being written was `useSunNorm` (from context). Changed to `useSunNorm`.
  useEffect(() => {
    if (!matRef.current) return;
    const eps = 1e-3;
    const mat = matRef.current;
    if (Math.abs(mat.uniforms.sunNorm.value - useSunNorm) > eps)
      mat.uniforms.sunNorm.value = useSunNorm;
    const u = mat.uniforms.sunUv.value as THREE.Vector2;
    if (Math.abs(u.x - sunUv[0]) > eps || Math.abs(u.y - sunUv[1]) > eps) {
      u.set(sunUv[0], sunUv[1]);
      sunUvRef.current.set(sunUv[0], sunUv[1]);
    }
    if (Math.abs(mat.uniforms.sunDot.value - sunDot) > eps)
      mat.uniforms.sunDot.value = sunDot;
  }, [useSunNorm, sunUv, sunDot]); // FIX: was [sunNorm, sunUv, sunDot]

  useFrame((state) => {
    if (matRef.current) {
      const now = state.clock.elapsedTime;
      const interval = 1.0 / 60.0;
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const dt = now - lastTimeRef.current;
      if (dt >= interval) {
        matRef.current.uniforms.time.value += dt;
        lastTimeRef.current = now;
      }
      matRef.current.uniforms.aspect.value =
        state.viewport.width / state.viewport.height;

      // FIX: also sync sunNorm every frame so it never gets stuck.
      // The useEffect handles initial + dependency changes, this catches
      // any frames where context updated but effect hasn't re-fired yet.
      const currentSun = ctx?.sunNorm ?? sunNorm;
      const eps = 1e-3;
      if (Math.abs(matRef.current.uniforms.sunNorm.value - currentSun) > eps) {
        matRef.current.uniforms.sunNorm.value = currentSun;
      }
    }

    if (!meshRef.current) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    camera.getWorldDirection(camDir.current);

    const distance = 200;
    const fov = (camera.fov * Math.PI) / 180;
    const height = 2 * distance * Math.tan(fov / 2);
    const width = height * (state.viewport.width / state.viewport.height);

    targetPos.current
      .copy(camera.position)
      .addScaledVector(camDir.current, distance);
    meshRef.current.position.copy(targetPos.current);
    meshRef.current.scale.set(width, height, 1);
    meshRef.current.quaternion.copy(camera.quaternion);
  });

  const vertex = `
    precision mediump float;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragment = `
    precision mediump float;
    varying vec2 vUv;
    uniform float time;
    uniform float speed;
    uniform float coverage;
    uniform vec3 cloudColor;
    uniform float scale;
    uniform float opacity;
    uniform float cloudBottom;
    uniform float sunNorm;
    uniform vec2 sunUv;
    uniform float sunDot;
    uniform float layerSpeed1;
    uniform float layerSpeed2;
    uniform float layerSpeed3;
    uniform float aspect;
    uniform float bigScale;
    uniform float bigStrength;
    uniform float bigCoverage;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
    }

    float fbm4(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for(int i=0;i<4;i++){
        v += a * noise(p);
        p = m * p * 1.8;
        a *= 0.5;
      }
      return v;
    }

    float fbm3(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for(int i=0;i<3;i++){
        v += a * noise(p);
        p = m * p * 1.8;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      vec2 centered = (vUv - 0.5) * vec2(aspect, 1.0);
      vec2 baseUV = centered * scale;

      vec2 baseWarp = vec2(fbm3(baseUV * 0.5 + vec2(time * 0.015, time * 0.008)), fbm3(baseUV * 0.45 - vec2(time * 0.01, time * 0.02)));

      vec2 uv1 = baseUV * 0.7 - vec2(time * speed * layerSpeed1, 0.0) + (baseWarp - 0.5) * 0.28;
      vec2 uv2 = baseUV * 1.6 - vec2(time * speed * layerSpeed2, 0.0) + (baseWarp - 0.5) * 0.18;
      vec2 uv3 = baseUV * 3.2 - vec2(time * speed * layerSpeed3, 0.0) + (baseWarp - 0.5) * 0.08;

      float layer1 = fbm3(uv1 + vec2(time * 0.02 * layerSpeed1, time * 0.008 * layerSpeed1));
      float layer2 = fbm3(uv2 + vec2(time * 0.015 * layerSpeed2, -time * 0.006 * layerSpeed2));
      float layer3 = fbm3(uv3 + vec2(-time * 0.01 * layerSpeed3, time * 0.012 * layerSpeed3));

      float m1 = smoothstep(0.35, 0.75, layer1);
      float m2 = smoothstep(0.40, 0.78, layer2) * 0.9;
      float m3 = smoothstep(0.45, 0.82, layer3) * 0.5;

      float vertical = fbm3((vUv + vec2(0.0, time * 0.007)) * 1.2);
      float centerFactor = smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - (cloudBottom + 0.12)) * 3.0);
      m1 *= mix(0.9, 1.35, centerFactor * vertical);
      m2 *= mix(0.85, 1.05, vertical * 0.9);
      m3 *= mix(0.75, 0.95, vertical * 0.7);

      float cloud = max(m1, max(m2 * 0.85, m3 * 0.6));

      float wisps = fbm3((uv1 + vec2(5.2, 7.3)) * 8.0 + vec2(time * 0.02));
      float wispsAmp = mix(0.004, 0.02, sunNorm);
      cloud += (wisps - 0.36) * wispsAmp;
      cloud = clamp(cloud, 0.0, 1.0);

      float nightContrast = mix(1.6, 1.0, sunNorm);
      cloud = pow(cloud, nightContrast);

      float edgeFade = smoothstep(0.06, 0.0, length(vUv - 0.5));
      cloud *= mix(1.0, 0.90, edgeFade);

      float heightMask = smoothstep(cloudBottom + 0.02, cloudBottom + 0.28, vUv.y);
      cloud *= heightMask;

      float macro = fbm4((centered) * bigScale + vec2(time * 0.002));
      float macroMask = smoothstep(bigCoverage - 0.16, bigCoverage + 0.10, macro);
      float macroContribution = clamp((macro - 0.40) * bigStrength * 1.15, 0.0, 1.0);
      cloud = mix(cloud, clamp(cloud + macroContribution * 1.0, 0.0, 1.0), macroMask * 0.92);

      vec3 dayCol = cloudColor;
      vec3 nightCol = vec3(0.02, 0.03, 0.06);
      float env = 0.02 + 0.88 * sunNorm;
      vec3 colBase = mix(nightCol, dayCol, sunNorm) * env;

      vec2 sunPos = sunUv;
      float dist = distance(vUv, sunPos);
      float spec = exp(-dist * 6.0) * sunDot * 1.2 * sunNorm;
      vec3 sunTint = vec3(1.0, 0.95, 0.82);
      colBase += sunTint * spec * cloud;

      vec3 tintNear = vec3(1.02, 1.01, 1.00);
      vec3 tintMid = vec3(0.98, 0.995, 1.00);
      vec3 tintFar = vec3(0.88, 0.92, 0.98);
      float br1 = 1.00;
      float br2 = 0.86;
      float br3 = 0.62;
      float layerSum = m1 * br1 + m2 * br2 + m3 * br3 + 0.0001;
      float layerNorm = m1 + m2 + m3 + 0.0001;
      float brightness = layerSum / layerNorm;
      vec3 tint = (tintNear * m1 + tintMid * m2 + tintFar * m3) / layerNorm;

      vec3 colMod = colBase * (0.55 + 0.9 * brightness);
      colMod = mix(colMod, colMod * tint, 0.28);

      float heightOpacity = mix(0.45, 1.0, smoothstep(cloudBottom, cloudBottom + 0.6, vUv.y));
      float a = cloud * opacity * mix(0.9, 1.0, sunNorm) * heightOpacity;
      if (a < 0.0015) discard;

      float sat = mix(0.25, 1.0, sunNorm);
      float gray = dot(colMod, vec3(0.299, 0.587, 0.114));
      vec3 nightTint = vec3(0.6, 0.65, 0.78);
      colMod = mix(colMod, colMod * nightTint, 1.0 - sunNorm);
      vec3 col = mix(vec3(gray), colMod, sat);

      gl_FragColor = vec4(col, a);
    }
  `;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, altitude, -120]}
      rotation={[0, 0, 0]}
      renderOrder={0}
    >
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent={true}
        depthWrite={false}
        depthTest={true}
        blending={THREE.NormalBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
