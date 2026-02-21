"use client";

// Based on https://codepen.io/al-ro/pen/jJJygQ by al-ro,
// rewritten for modern @react-three/fiber + Three.js (r183+)
// Optimised as a non-interactive background effect

import * as THREE from "three";
import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import { usePerformance } from "./usePerformance";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { easing } from "maath";
import { createNoise2D } from "simplex-noise";

/* ------------------------------------------------------------------ */
/*  Simplex helpers                                                    */
/* ------------------------------------------------------------------ */

const noise2D = createNoise2D();

function getYPosition(x: number, z: number) {
  let y = 2 * noise2D(x / 50, z / 50);
  y += 4 * noise2D(x / 100, z / 1000);
  y += 0.2 * noise2D(x / 10, z / 10);
  return y;
}

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

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

const BLADE_WIDTH = 0.08;
const BLADE_HEIGHT = 0.85;
const BLADE_JOINTS = 5;
const INSTANCES = 45000; // reduced from 50 000 for perf
const FIELD_WIDTH = 121; // Increase the field width to ensure it extends off-screen horizontally

function Grass() {
  const materialRef = useRef<THREE.RawShaderMaterial>(null);
  const perf = usePerformance();

  const [texture, alphaMap] = useLoader(THREE.TextureLoader, [
    "/blade_diffuse.jpg",
    "/blade_alpha.jpg",
  ]);

  const instances = perf.isLow ? Math.max(10000, Math.floor(INSTANCES * 0.25)) : INSTANCES;
  const attributeData = useMemo(() => getAttributeData(instances, FIELD_WIDTH), [instances]);

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

  const customClock = useMemo(() => new THREE.Clock(), []);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    // Slow down animation when in low-power mode
    const timeFactor = perf.isLow ? 8 : 4;
    materialRef.current.uniforms.time.value = customClock.getElapsedTime() / timeFactor;
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
          uniforms={{
            map: { value: texture },
            alphaMap: { value: alphaMap },
            time: { value: 0 },
          }}
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
}

/* ------------------------------------------------------------------ */
/*  Camera Controller for mouse following                             */
/* ------------------------------------------------------------------ */

function CameraController() {
  useFrame((state, delta) => {
    easing.damp3(
      state.camera.position,
      [1 + state.pointer.x * 0.52, 8 + state.pointer.y * 0.45, 25],
      0.3,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/*  Exported background component                                      */
/* ------------------------------------------------------------------ */

export default function GrassBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const perf = usePerformance();

  const getDPR = () => {
    try {
      const deviceMemory = (navigator as any).deviceMemory || 4;
      const hc = (navigator as any).hardwareConcurrency || 4;
      const DPR = window.devicePixelRatio || 1;
      if (deviceMemory <= 1 || hc <= 2) return [1, 1] as any;
      if (DPR > 2) return [1, 1.5] as any;
      return [1, DPR] as any;
    } catch (e) {
      return [1, 1.5] as any;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsVisible(e.isIntersecting)),
      { threshold: 0.05 },
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
    >
      {perf.isLow ? (
        <div className="canvas-placeholder" aria-hidden="true" />
      ) : (
        <Canvas
        dpr={perf.isLow ? [1, 1] : getDPR()}
        frameloop={perf.isLow ? "demand" : isVisible ? "always" : "demand"}
        camera={{ position: [1, 8, 25], fov: 50 }}
        gl={{
          powerPreference: "low-power",
          antialias: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 90]} intensity={0.125} />
        <Suspense fallback={null}>
          <CameraController />
          <Grass />
          <Sky sunPosition={[0, 10, -1000]} turbidity={100} rayleigh={0.97} />
        </Suspense>
      </Canvas>
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(79, 74, 87, 0.45)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function computeAttributeData() {
  const offsets: number[] = [];
  const orientations: number[] = [];
  const stretches: number[] = [];
  const halfRootAngleSin: number[] = [];
  const halfRootAngleCos: number[] = [];

  let quaternion_0 = new THREE.Vector4();
  let quaternion_1 = new THREE.Vector4();

  const min = -0.25;
  const max = 0.25;

  for (let i = 0; i < INSTANCES; i++) {
    const offsetX = Math.random() * FIELD_WIDTH - FIELD_WIDTH / 2;
    const offsetZ = Math.random() * FIELD_WIDTH - FIELD_WIDTH / 2;
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

    stretches.push(i < INSTANCES / 3 ? Math.random() * 1.8 : Math.random());
  }

  return {
    offsets: new Float32Array(offsets),
    orientations: new Float32Array(orientations),
    stretches: new Float32Array(stretches),
    halfRootAngleCos: new Float32Array(halfRootAngleCos),
    halfRootAngleSin: new Float32Array(halfRootAngleSin),
  };
}

function computeBaseGeometry() {
  const geo = new THREE.PlaneGeometry(
    BLADE_WIDTH,
    BLADE_HEIGHT,
    1,
    BLADE_JOINTS,
  );
  geo.translate(0, BLADE_HEIGHT / 2, 0);
  return geo;
}

function computeGroundGeometry() {
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
}
