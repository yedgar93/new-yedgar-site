"use client";

// Based on https://codepen.io/al-ro/pen/jJJygQ by al-ro,
// rewritten for modern @react-three/fiber + Three.js (r183+)
// Optimised as a non-interactive background effect

import * as THREE from "three";
import { useRef, useMemo, memo, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import Clouds from "./Clouds";
import { easing } from "maath";
import { createNoise2D } from "simplex-noise";
import { position } from "html2canvas/dist/types/css/property-descriptors/position";

/* ------------------------------------------------------------------ */
/*  Constants — declared at top so nothing references before init      */
/* ------------------------------------------------------------------ */

// Module-level color objects — never allocated per-frame
const _dayColor = new THREE.Color(1, 0.78, 0.59);
const _nightColor = new THREE.Color(0.1, 0.1, 0.2);
const _interpColor = new THREE.Color();

export const DAY_NIGHT_PERIOD = 145; // seconds for full cycle

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

const BLADE_HEIGHT = 2.23;

const getVertexSource = (height: number) => `
precision mediump float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;
attribute vec3 offset;
attribute vec2 uv;
attribute vec4 orientation;
attribute float halfRootAngleSin;
attribute float halfRootAngleCos;
attribute float stretch;
uniform float time;
varying vec2 vUv;
varying float frc;
varying float vWind;

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
  vec3 vPosition = vec3(position.x, position.y + position.y*stretch, position.z);
  vPosition = rotateVectorByQuaternion(vPosition, direction);
  vPosition = rotateVectorByQuaternion(vPosition, normalize(vec4(sin(sway), 0.0, -sin(sway), cos(sway))));
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(offset + vPosition, 1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform sampler2D map;
uniform sampler2D alphaMap;
varying vec2 vUv;
varying float frc;
varying float vWind;
uniform vec3 dayColor;
uniform vec3 nightColor;
uniform float sunNorm;

void main(){
  float alpha = texture2D(alphaMap, vUv).r;
  if(alpha < 0.15) discard;

  vec4 texCol = texture2D(map, vUv);

  // Base grass color lerp: dark root → mid green → dry yellow tip
  vec3 rootCol  = vec3(0.03, 0.09, 0.02);   // very dark at soil
  vec3 midCol   = vec3(0.13, 0.42, 0.08);   // healthy mid-blade green
  vec3 tipCol   = vec3(0.55, 0.52, 0.18);   // slightly dry/yellow tip

  vec3 grassCol = mix(rootCol, midCol, smoothstep(0.0, 0.5, frc));
  grassCol      = mix(grassCol, tipCol, smoothstep(0.5, 1.0, frc));

  // Blend with diffuse texture
  vec3 col = mix(grassCol, texCol.rgb, 0.45);

  // Ambient occlusion — darken base independent of texture
  float ao = smoothstep(0.0, 0.3, frc);
  col *= 0.4 + 0.6 * ao;

  // Wind-driven tip brightening — blades in a gust catch more light
  col += vec3(0.04, 0.05, 0.01) * vWind * smoothstep(0.6, 1.0, frc);

  // Simple distance fog — blend to a pale sky color at far blades
  // frc proxy for depth isn't ideal but vUv.y correlates with world height
  // Real fog would need camera distance; this is a cheap approximation
  float fogFactor = smoothstep(0.0, 1.0, vUv.y * 0.3);
  vec3 fogColor = vec3(0.78, 0.88, 0.95);
  col = mix(col, fogColor, fogFactor * 0.18);

  // Night blending — darken grass at night
  col = mix(nightColor, col, sunNorm);

  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ */
/*  Attribute data (computed once at module load)                      */
/* ------------------------------------------------------------------ */

function multiplyQuaternions(q1: THREE.Vector4, q2: THREE.Vector4) {
  const x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;
  const y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;
  const z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;
  const w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;
  return new THREE.Vector4(x, y, z, w);
}

function getAttributeData(instances: number, width: number) {
  const offsets: number[] = [];
  const orientations: number[] = [];
  const stretches: number[] = [];
  const halfRootAngleSin: number[] = [];
  const halfRootAngleCos: number[] = [];

  let quaternion_0 = new THREE.Vector4();
  let quaternion_1 = new THREE.Vector4();

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

    let axis = new THREE.Vector3(0, 1, 0);
    quaternion_0
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();

    angle = Math.random() * (max - min) + min;
    axis = new THREE.Vector3(1, 0, 0);
    quaternion_1
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    angle = Math.random() * (max - min) + min;
    axis = new THREE.Vector3(0, 0, 1);
    quaternion_1
      .set(
        axis.x * Math.sin(angle / 2),
        axis.y * Math.sin(angle / 2),
        axis.z * Math.sin(angle / 2),
        Math.cos(angle / 2),
      )
      .normalize();
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    orientations.push(
      quaternion_0.x,
      quaternion_0.y,
      quaternion_0.z,
      quaternion_0.w,
    );

    stretches.push(i < instances / 3 ? Math.random() * 1.8 : Math.random());
  }

  return {
    offsets: new Float32Array(offsets),
    orientations: new Float32Array(orientations),
    stretches: new Float32Array(stretches),
    halfRootAngleCos: new Float32Array(halfRootAngleCos),
    halfRootAngleSin: new Float32Array(halfRootAngleSin),
  };
}

/* ------------------------------------------------------------------ */
/*  Grass mesh                                                         */
/* ------------------------------------------------------------------ */

const BLADE_WIDTH = 0.049;
const BLADE_JOINTS = 10;
const INSTANCES = 44000;
const FIELD_WIDTH = 111;

const Grass = memo(function Grass() {
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
    }),
    [texture, alphaMap],
  );

  // Wind sway is now entirely in the vertex shader — no vertex buffer writes here
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.elapsedTime / 4;
    }
  });

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
            attach="attributes-halfRootAngleSin"
            args={[attributeData.halfRootAngleSin, 1]}
          />
          <instancedBufferAttribute
            attach="attributes-halfRootAngleCos"
            args={[attributeData.halfRootAngleCos, 1]}
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
});

/* ------------------------------------------------------------------ */
/*  Camera Controller                                                  */
/* ------------------------------------------------------------------ */

function CameraController() {
  const ready = useRef(false);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.06);
    const target: [number, number, number] = [
      1 + state.pointer.x * 0.7,
      8 + state.pointer.y * 0.6,
      25,
    ];
    if (!ready.current) {
      state.camera.position.set(...target);
      state.camera.lookAt(0, 0, -20);
      ready.current = true;
    } else {
      easing.damp3(state.camera.position, target, 0.3, d);
      state.camera.lookAt(0, 0, -20);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Animated sky + light                                               */
/* ------------------------------------------------------------------ */

let _lastSunY = 9999;

function AnimatedEnvironment() {
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
    const sunY = Math.sin(t) * 50 + 5;

    // Always update light (cheap)
    const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));
    if (lightRef.current) {
      const baseIntensity = 0.01;
      const peakIntensity = 1.2;
      const horizonBoost = Math.max(0, Math.sin(t) * 0.2);
      lightRef.current.intensity =
        baseIntensity +
        sunNorm * (peakIntensity - baseIntensity) +
        horizonBoost;
      // Reuse module-level objects — no allocation
      _interpColor.copy(_dayColor).lerp(_nightColor, 1 - sunNorm);
      lightRef.current.color.copy(_interpColor);
    }

    // Skip sky uniform writes when sun hasn't moved meaningfully
    if (Math.abs(sunY - _lastSunY) < 0.05) return;
    _lastSunY = sunY;

    const sunX = Math.cos(t) * 700;
    const sunZ = -1000;

    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.set(sunX, sunY, sunZ);
    }
    if (skyRef.current?.material?.uniforms?.mieDirectionalG) {
      skyRef.current.material.uniforms.mieDirectionalG.value =
        0.1 + sunNorm * 0.7;
    }
    if (skyRef.current?.material?.uniforms?.rayleigh) {
      skyRef.current.material.uniforms.rayleigh.value =
        0.375 + (1 - sunNorm) * 5.5;
    }
    if (skyRef.current?.material?.uniforms?.mieCoefficient) {
      skyRef.current.material.uniforms.mieCoefficient.value =
        0.01 + (1 - sunNorm) * 0.09;
    }
    if (skyRef.current?.material?.uniforms?.turbidity) {
      const sunEdge = 1 - Math.min(1, Math.max(0, sunY / 90));
      skyRef.current.material.uniforms.turbidity.value =
        1.0 + sunEdge * 5 + (1 - sunNorm) * 14;
    }
  });

  return (
    <>
      <ambientLight ref={lightRef} intensity={1.05} />
      <Sky
        ref={skyRef}
        sunPosition={[0, 100, -4000]}
        turbidity={0.91}
        rayleigh={0.375}
        mieCoefficient={0.01}
        mieDirectionalG={0.1}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported background component                                      */
/* ------------------------------------------------------------------ */

export default function GrassBackground({
  progress = 0,
}: {
  progress?: number;
}) {
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

  function OverlayController({
    setOverlayOpacity,
  }: {
    setOverlayOpacity: (opacity: number) => void;
  }) {
    useFrame(({ clock }) => {
      const t = clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
      const sunY = Math.sin(t) * 50 + 5;
      const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));

      // Update overlay opacity based on sunNorm
      setOverlayOpacity(1 - sunNorm);
      // Set opacity: fully visible at night, fades out during the day
      const maxOpacity = 0.53;
      const minOpacity = 0; // Ensure it fades completely out during the day
      const opacity =
        sunNorm < 0.18
          ? maxOpacity
          : Math.max(minOpacity, (1 - sunNorm) * maxOpacity);
      setMidnightOpacity(opacity);
    });

    return null;
  }

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

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1, // Ensure it is above the grass, sky, and sun but below the nav and page content
          pointerEvents: "none",
          background: "rgba(1, 1, 38, .93)", // Midnight blue
          opacity: midnightOpacity,
          mixBlendMode: "multiply", // Ensure proper blending with the background
          transition: "opacity 0.5s ease-in-out", // Smooth transition for fading
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
          dpr={[1, 1.5]}
          frameloop={isVisible && isTabVisible ? "always" : "demand"}
          gl={{ powerPreference: "low-power", antialias: true }}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        >
          <Suspense fallback={null}>
            <AnimatedEnvironment />
            <Clouds />
            <OverlayController setOverlayOpacity={setOverlayOpacity} />
            <CameraController />
            <Grass />
          </Suspense>
        </Canvas>
      </div>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 2,
          pointerEvents: "none",
          opacity: 0.125,
        }}
      >
        <div
          className="grain"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            width: "100vw",
            height: "100vh",
            background: "#383838",
            opacity: 0.323,
            mixBlendMode: "difference",
          }}
        />
      </div>
    </div>
  );
}
