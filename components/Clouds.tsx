"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

const DAY_NIGHT_PERIOD = 145; // seconds for full day/night cycle (matches GrassBackground)

export default function Clouds({
  speed = 0.05,
  coverage = 0.5,
  altitude = 69,
  // UV scale (higher => more visible cloud detail on unit UVs)
  scale = 20.0,
  // how low clouds should appear (0 bottom -> 1 top)
  cloudBottom = 0.65,
  // per-layer speed multipliers for parallax (near -> far)
  layerSpeed1 = 12,
  layerSpeed2 = 3,
  layerSpeed3 = 0.2,
  // performance: render cloud shader into low-res render target and upsample
  useLowResRender = true,
  // fraction of full resolution to render clouds at (0.2..1.0)
  lowResFactor = 0.45,
  // update FPS for the low-res target (Hz)
  lowResFps = 30,
}: {
  speed?: number;
  coverage?: number;
  altitude?: number;
  scale?: number;
  cloudBottom?: number;
  layerSpeed1?: number;
  layerSpeed2?: number;
  layerSpeed3?: number;
  useLowResRender?: boolean;
  lowResFactor?: number;
  lowResFps?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const lastTimeRef = useRef<number>(0);
  // low-res render target / offscreen scene refs
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const offSceneRef = useRef<THREE.Scene | null>(null);
  const offCamRef = useRef<THREE.OrthographicCamera | null>(null);
  const lastOffRef = useRef<number>(0);

  // Unit plane; we'll scale it each frame to exactly fill the camera frustum at `distance`
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 1, 1), []);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      speed: { value: speed },
      coverage: { value: coverage },
      // Default cloud color (white) — background will be transparent
      cloudColor: { value: new THREE.Color(12.0, 11.0, 11.0) },
      scale: { value: scale },
      opacity: { value: 0.55 },
      sunNorm: { value: 1.5 },
      sunUv: { value: new THREE.Vector2(0.5, 0.5) },
      sunDot: { value: 1.0 },
      cloudBottom: { value: cloudBottom },
      layerSpeed1: { value: layerSpeed1 },
      layerSpeed2: { value: layerSpeed2 },
      layerSpeed3: { value: layerSpeed3 },
    }),
    [speed, coverage, scale],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
    const sunY = Math.sin(t) * 50 + 5;
    const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));
    if (matRef.current) {
      // Limit cloud animation updates to 60Hz to reduce work on the shader
      const now = state.clock.elapsedTime;
      const interval = 1.0 / 60.0;
      // Initialize last time if zero
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const dt = now - lastTimeRef.current;
      if (dt >= interval) {
        // advance the shader time by the elapsed amount since last update
        matRef.current.uniforms.time.value += dt;
        lastTimeRef.current = now;
      }

      matRef.current.uniforms.sunNorm.value = sunNorm;
    }

    // compute sun world position (must match AnimatedEnvironment logic)
    const sunX = Math.cos(t) * 700;
    const sunZ = -1000;
    const sunWorld = new THREE.Vector3(sunX, sunY, sunZ);

    // compute sun position in mesh local space -> map to UV
    if (meshRef.current) {
      const local = meshRef.current.worldToLocal(sunWorld.clone());
      const sx = local.x / meshRef.current.scale.x + 0.5;
      const sy = local.y / meshRef.current.scale.y + 0.5;
      if (matRef.current && matRef.current.uniforms.sunUv) {
        matRef.current.uniforms.sunUv.value.set(sx, sy);
      }
      // sunDot: how much sun faces the camera (dot between sun direction and camera forward)
      const camDir = new THREE.Vector3();
      state.camera.getWorldDirection(camDir);
      const sunDir = new THREE.Vector3()
        .subVectors(sunWorld, state.camera.position)
        .normalize();
      const sunDot = Math.max(0, sunDir.dot(camDir));
      if (matRef.current && matRef.current.uniforms.sunDot) {
        matRef.current.uniforms.sunDot.value = sunDot;
      }
    }

    if (!meshRef.current) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    // Distance from camera to place the cloud plane.
    const distance = 200;

    // compute frustum size at distance: height = 2 * distance * tan(fov/2)
    const fov = (camera.fov * Math.PI) / 180;
    const height = 2 * distance * Math.tan(fov / 2);
    const width = height * (state.viewport.width / state.viewport.height);

    // position & scale
    const targetPos = new THREE.Vector3()
      .copy(camera.position)
      .add(dir.multiplyScalar(distance));
    meshRef.current.position.copy(targetPos);
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

    // simple hash / value noise
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

    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      // reduced octaves: 4 instead of 5 for cheaper evaluation
      for(int i=0;i<4;i++){
        v += a * noise(p);
        p = m * p * 1.8;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      // Domain-warped, layered FBM for evolving, fluffy clouds
      vec2 baseUV = vUv * scale;

      // reduce warp amplitude slightly to cut down on extra FBM noise calls' range
      vec2 baseWarp = vec2(fbm(baseUV * 0.7 + vec2(time * 0.02, time * 0.01)), fbm(baseUV * 0.6 - vec2(time * 0.015, time * 0.03)));

      // smaller warp multipliers per-layer to reduce heavy math impact while preserving look
      vec2 uv1 = baseUV - vec2(time * speed * layerSpeed1, 0.0) + (baseWarp - 0.5) * 0.55;
      vec2 uv2 = baseUV - vec2(time * speed * layerSpeed2, 0.0) + (baseWarp - 0.5) * 0.30;
      vec2 uv3 = baseUV - vec2(time * speed * layerSpeed3, 0.0) + (baseWarp - 0.5) * 0.15;

      // Three layers at different scales and subtle time offsets
      float layer1 = fbm(uv1 * 0.9 + vec2(time * 0.03 * layerSpeed1, time * 0.01 * layerSpeed1));
      float layer2 = fbm(uv2 * 1.8 + vec2(time * 0.02 * layerSpeed2, -time * 0.01 * layerSpeed2));
      float layer3 = fbm(uv3 * 3.6 + vec2(-time * 0.015 * layerSpeed3, time * 0.02 * layerSpeed3));

      // Composite layers with different weights; use pow to increase contrast
      float baseVal = pow(mix(layer1 * 0.6 + layer2 * 0.3 + layer3 * 0.1, layer1, 0.25), 1.15);

      // apply a vertical variation so clouds have thickness/patchiness
      float vertical = fbm((vUv + vec2(0.0, time*0.01)) * 1.5);
      baseVal *= mix(0.8, 1.2, vertical);

      // soft threshold to produce alpha mask
      float cloud = smoothstep(coverage - 0.22, coverage + 0.08, baseVal);

      // add finer wisps
      // finer wisps at higher freq but lower amplitude
      float wisps = fbm((uv1 + vec2(5.2,7.3)) * 6.0 + vec2(time * 0.02));
      cloud += (wisps - 0.30) * 0.06;
      cloud = clamp(cloud, 0.0, 1.0);

      // fade clouds near edges to avoid hard silhouette
      float edgeFade = smoothstep(0.02, 0.0, length(vUv - 0.5));
      cloud *= mix(1.0, 0.85, edgeFade);

      // mask clouds so they only appear near the top of the screen
      float heightMask = smoothstep(cloudBottom, cloudBottom + 0.18, vUv.y);
      cloud *= heightMask;

      // Day/night color and brightness
      // Darker, slightly bluish clouds at night
      vec3 dayCol = cloudColor;
      vec3 nightCol = vec3(0.08, 0.10, 0.14);
      // overall environmental brightness (0.28..1.0)
      float env = 0.28 + 0.72 * sunNorm;
      vec3 colBase = mix(nightCol, dayCol, sunNorm) * env;

      // localized sun specular (soft), scaled by sunNorm so it's absent at night
      vec2 sunPos = sunUv;
      float dist = distance(vUv, sunPos);
      float spec = exp(-dist * 6.0) * sunDot * 1.2 * sunNorm;
      vec3 sunTint = vec3(1.0, 0.95, 0.82);
      colBase += sunTint * spec * cloud;

      // alpha scaled with day (clouds less bright at night)
      float a = cloud * opacity * (0.5 + 0.5 * sunNorm);
      if (a < 0.0015) discard;

      // slight desaturation at night
      float sat = mix(0.6, 1.0, sunNorm);
      float gray = dot(colBase, vec3(0.299, 0.587, 0.114));
      vec3 col = mix(vec3(gray), colBase, sat);

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
        // allow depth testing so nearer objects (grass) occlude this layer
        depthTest={true}
        blending={THREE.NormalBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
