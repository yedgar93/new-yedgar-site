"use client";

// Based on https://codepen.io/al-ro/pen/jJJygQ by al-ro,
// rewritten for modern @react-three/fiber + Three.js (r183+)
// Optimised as a non-interactive background effect

import * as THREE from "three";
import { useRef, useMemo, memo, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { easing } from "maath";
import { createNoise2D } from "simplex-noise";

/* ------------------------------------------------------------------ */
/*  Simplex helpers                                                    */
/* ------------------------------------------------------------------ */

const noise2D = createNoise2D();

function getYPosition(x: number, z: number) {
  const cache = new Map<string, number>(); // Cache for storing computed values
  const key = `${x},${z}`; // Create a unique key for each x, z pair

  if (cache.has(key)) {
    return cache.get(key)!.value; // Return cached value if it exists
  }

  let y = 2 * noise2D(x / 50, z / 50);
  y += 4 * noise2D(x / 100, z / 1000);
  y += 0.2 * noise2D(x / 10, z / 10);

  cache.set(key, y); // Cache the computed value
  return y;
}

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

const getVertexSource = (height: number) => `
precision mediump float; // Changed to mediump for lower precision
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

// simplex noise (Ashima Arts / stegu)
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
  frc=position.y/float(${height});
  float noise=1.0-(snoise(vec2((time-offset.x/50.0),(time-offset.z/50.0))));
  vec4 direction=vec4(0.0,halfRootAngleSin,0.0,halfRootAngleCos);
  direction=slerp(direction,orientation,frc);
  vec3 vPosition=vec3(position.x,position.y+position.y*stretch,position.z);
  vPosition=rotateVectorByQuaternion(vPosition,direction);
  float halfAngle=noise*0.15;
  vPosition=rotateVectorByQuaternion(vPosition,normalize(vec4(sin(halfAngle),0.0,-sin(halfAngle),cos(halfAngle))));
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(offset+vPosition,1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform sampler2D map;
uniform sampler2D alphaMap;
varying vec2 vUv;
varying float frc;

void main(){
  float alpha=texture2D(alphaMap,vUv).r;
  if(alpha<0.15) discard;
  vec4 col=vec4(texture2D(map,vUv));
  col=mix(vec4(0.0,0.6,0.0,1.0),col,frc);
  col=mix(vec4(0.0,0.1,0.0,1.0),col,frc);
  gl_FragColor=col;
}`;

/* ------------------------------------------------------------------ */
/*  Attribute data (computed once)                                     */
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

    // Random Y rotation
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

    // Random X rotation
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

    // Random Z rotation
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

const BLADE_WIDTH = 0.047;
const BLADE_HEIGHT = 2.23;
const BLADE_JOINTS = 10;
const INSTANCES = 42000; // Reduced from 47000 for performance optimization
const FIELD_WIDTH = 121; // Increase the field width to ensure it extends off-screen horizontally

const Grass = memo(function Grass() {
  const materialRef = useRef<THREE.RawShaderMaterial>(null);

  const [texture, alphaMap] = useLoader(THREE.TextureLoader, [
    "/blade_diffuse.jpg",
    "/blade_alpha.jpg",
  ]);

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

  const customClock = useMemo(() => {
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      getElapsedTime: () =>
        ((typeof performance !== "undefined" ? performance.now() : Date.now()) -
          start) /
        1000,
    } as {
      getElapsedTime: () => number;
    };
  }, []);

  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      alphaMap: { value: alphaMap },
      time: { value: 0 },
    }),
    [texture, alphaMap],
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value =
        customClock.getElapsedTime() / 4;
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
/*  Camera Controller for mouse following                             */
/* ------------------------------------------------------------------ */

function CameraController() {
  const initialPosition = useRef(false);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.06);

    // Set the initial position only once
    if (!initialPosition.current) {
      state.camera.position.set(
        1 + state.pointer.x * 0.7, // Horizontal movement sensitivity
        8 + state.pointer.y * 0.6, // Vertical movement sensitivity
        25,
      );
      state.camera.lookAt(0, 0, 0);
      initialPosition.current = true;
    }

    // Smoothly update the camera position only if pointer has moved
    if (state.pointer.x !== 0 || state.pointer.y !== 0) {
      easing.damp3(
        state.camera.position,
        [1 + state.pointer.x * 0.7, 8 + state.pointer.y * 0.6, 25],
        0.3,
        d,
      );
      state.camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Animated sky + light that smoothly tracks progress                 */
/* ------------------------------------------------------------------ */

// Day/night cycle: 2 minute period (1 min day, 1 min night)
const DAY_NIGHT_PERIOD = 180; // seconds for full cycle

function AnimatedEnvironment() {
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);

  useFrame(({ clock }) => {
    // t goes 0→2π over DAY_NIGHT_PERIOD seconds
    const t = clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
    // sunY: sin curve — positive = day, negative = night
    // Range: ~-45 to ~55 (centered around 5)
    const sunY = Math.sin(t) * 50 + 5;

    // sunNorm: 0 at night, 1 at noon
    const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65)); // Adjusted for smoother transition

    const fadeDuration = 25; // Increased fade duration for smoother transition

    const isNight = sunY < -10; // Determine if it's night
    const fadeFactor = isNight
      ? Math.min(1, Math.max(0, (Math.abs(sunY) - 10) / fadeDuration)) // Gradual fade to night
      : Math.max(0, Math.min(1, (sunY + 10) / fadeDuration)); // Gradual fade to day

    const opacity = isNight
      ? 0.5 + fadeFactor * 0.5 // Fade to 0.5 at night
      : 0.125 + fadeFactor * 0.375; // Gradual fade from 0.125 to 0.5 during sunset

    // Apply opacity to the specific div dynamically
    const divElement = document.querySelector(
      "div[style*='background-color: black'",
    );
    if (divElement) {
      divElement.style.opacity = opacity.toString();
    }

    if (skyRef.current?.material?.uniforms?.sunPosition) {
      // Smoothly move the sun below the horizon before disappearing
      const sunVisible = sunY > -10; // Allow sun to go slightly below horizon before hiding
      skyRef.current.material.uniforms.sunPosition.value.set(
        Math.cos(t) * 500,
        sunVisible ? sunY : -1000, // Gradual descent below horizon
        -1000,
      );
    }
    if (lightRef.current) {
      // Gradual light intensity transition
      const baseIntensity = 0.01; // Minimum light intensity at night
      const peakIntensity = 1.2; // Maximum light intensity during the day
      const horizonBoost = Math.max(0, Math.sin(t) * 0.2); // Light peaking at the horizon
      lightRef.current.intensity =
        baseIntensity +
        sunNorm * (peakIntensity - baseIntensity) +
        horizonBoost; // Smooth fade-out with light peaking at sunrise

      // Smoothly interpolate light color during transitions
      const dayColor = new THREE.Color(1, 0.78, 0.59); // Daylight color (RGB normalized)
      const nightColor = new THREE.Color(0.1, 0.1, 0.2); // Nighttime color (dark blueish)
      const interpolatedColor = dayColor.lerp(nightColor, 1 - sunNorm); // Interpolate based on sunNorm
      lightRef.current.color = interpolatedColor;
    }

    // Gradual fade-out of orange in the sky during sunset
    if (skyRef.current?.material?.uniforms?.mieDirectionalG) {
      const sunsetOrange = 0.8; // Intensity of orange during sunset
      const nightBlue = 0.1; // Intensity of blue at night
      skyRef.current.material.uniforms.mieDirectionalG.value =
        nightBlue + sunNorm * (sunsetOrange - nightBlue); // Gradual fade from orange to blue
    }

    // Darken sky at night via rayleigh
    if (skyRef.current?.material?.uniforms?.rayleigh) {
      skyRef.current.material.uniforms.rayleigh.value =
        0.375 + (1 - sunNorm) * 5.5; // Further increase darkening effect at night
    }

    // Remove color from the sky at night
    if (skyRef.current?.material?.uniforms?.mieCoefficient) {
      skyRef.current.material.uniforms.mieCoefficient.value =
        0.01 + (1 - sunNorm) * 0.09; // Further increase mieCoefficient to remove color
    }

    // Adjust turbidity: low at noon (blue sky), higher at sunrise/sunset
    if (skyRef.current?.material?.uniforms?.turbidity) {
      // sunEdge: 1 near horizon, 0 at noon — drives warmer sunset look
      const sunEdge = 1 - Math.min(1, Math.max(0, sunY / 90));
      // Day: 1.0 (cool blue), Horizon: ~6 (warm haze), Night: ~15
      skyRef.current.material.uniforms.turbidity.value =
        1.0 + sunEdge * 5 + (1 - sunNorm) * 14; // Increase turbidity at night for a darker sky
    }
  });

  return (
    <>
      <ambientLight ref={lightRef} intensity={1.05} />
      <Sky
        ref={skyRef}
        sunPosition={[0, 100, -4000]}
        turbidity={0.91}
        rayleigh={-0.52}
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
  const [isTabVisible, setIsTabVisible] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState(false); // New state to track loading

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsVisible(e.isIntersecting)),
      { threshold: 0.01 },
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Pause rendering when the page/tab is hidden to avoid large delta jumps
  useEffect(() => {
    const handle = () => setIsTabVisible(!document.hidden);
    handle();
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  // Sun position logic for opacity
  const [skyOpacity, setSkyOpacity] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = (performance.now() / 1000) % DAY_NIGHT_PERIOD; // Simulated time in seconds
      const sunY = Math.sin((t / DAY_NIGHT_PERIOD) * Math.PI * 2) * 50 + 5; // Simulated sun position
      const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));
      const minOpacity = 0;
      const maxOpacity = 0.35;
      const opacity = maxOpacity - sunNorm * (maxOpacity - minOpacity);
      setSkyOpacity(opacity);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Midnight blue overlay for night effect
  const [midnightOpacity, setMidnightOpacity] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Use the DAY_NIGHT_PERIOD to calculate the sun's position
      const t = (performance.now() / 1000) % DAY_NIGHT_PERIOD; // Simulated time in seconds
      const sunY = Math.sin((t / DAY_NIGHT_PERIOD) * Math.PI * 2) * 50 + 5; // Simulated sun position

      // Calculate normalized sun position (0 at night, 1 at noon)
      const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));

      // Set opacity: fully visible at night, fades out during the day
      const maxOpacity = 0.35;
      const minOpacity = 0; // Ensure it fades completely out during the day
      const opacity =
        sunNorm < 0.18
          ? maxOpacity
          : Math.max(minOpacity, (1 - sunNorm) * maxOpacity);
      setMidnightOpacity(opacity);
    }, 100);

    return () => clearInterval(interval);
  }, [DAY_NIGHT_PERIOD]);

  // Handle loading state for smooth appearance
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoaded(true); // Set loaded state after a short delay
    }, 500); // Adjust delay as needed

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        opacity: isLoaded ? 1 : 0, // Fade in the entire scene
        transition: "opacity 1s ease-in-out", // Smooth transition
      }}
    >
      {/* Sky blue gradient background div (background) */}
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
          opacity: skyOpacity,
          transition: "opacity 0.5s",
        }}
      />

      {/* Grass Canvas and sky */}
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
          frameloop={isVisible && isTabVisible ? "always" : "demand"}
          gl={{
            powerPreference: "low-power",
            antialias: true,
          }}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        >
          <Suspense fallback={null}>
            <AnimatedEnvironment />
            <CameraController />
            <Grass />
          </Suspense>
        </Canvas>
      </div>

      {/* Midnight blue overlay for night effect */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 12,
          pointerEvents: "none",
          mixBlendMode: "multiply", // Corrected property name
        }}
      />
    </div>
  );
}
