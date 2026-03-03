"use client";

import { useRef, useEffect, useContext } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SunContext } from "./SunContext";

useGLTF.preload("/buster.glb");

export default function BusterSword() {
  const { scene } = useGLTF("/buster.glb");
  const groupRef = useRef<THREE.Group>(null);
  const { scene: threeScene } = useThree();
  const { sunNorm } = useContext(SunContext);
  const nightLightTopRef = useRef<THREE.PointLight>(null);
  const nightLightMidRef = useRef<THREE.PointLight>(null);
  const nightLightBotRef = useRef<THREE.PointLight>(null);

  // Drive all three night fill lights — spread along the blade so the
  // whole sword face gets even, subtle illumination rather than a pinpoint.
  useFrame(() => {
    const nightFactor = Math.max(0, 0.67 - sunNorm);
    const intensity = 1.0 + nightFactor * 2.63;
    if (nightLightTopRef.current)
      nightLightTopRef.current.intensity = intensity;
    if (nightLightMidRef.current)
      nightLightMidRef.current.intensity = intensity;
    if (nightLightBotRef.current)
      nightLightBotRef.current.intensity = intensity;
  });

  // Ensure the sword is also present on layer 1 so it gets rendered
  // during the layer-1 pass (stars are drawn in layer 1 after composer).
  // Also enable castShadow on every mesh in the sword model so the
  // directional sun light can project its shadow onto the ground.
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.layers.enable(1);
      const setOrder = (obj: any) => {
        obj.renderOrder = 9999;
        // Enable shadow casting on every mesh in the sword hierarchy
        if (obj.isMesh) {
          obj.castShadow = true;
        }
        if (obj.children && obj.children.length)
          obj.children.forEach((c: any) => setOrder(c));
      };
      setOrder(groupRef.current);
    }
  }, []);

  // Apply scene env map + boost envMapIntensity so the sword
  // actually picks up reflections from the sky and sun light.
  useEffect(() => {
    scene.traverse((child: any) => {
      if (!child.isMesh || !child.material) return;

      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];

      mats.forEach((mat: THREE.MeshStandardMaterial) => {
        // Inherit the scene environment (set by the Sky / drei Environment)
        mat.envMap = threeScene.environment ?? mat.envMap;
        // How strongly the environment reflects — 1.0 is physically neutral,
        // higher values give more dramatic metallic glint.
        mat.envMapIntensity = 0.35;
        // Slightly boost metalness so the blade catches the sunrise glint
        if (mat.metalness !== undefined) {
          mat.metalness = Math.min(1, mat.metalness + 0.075);
        }
        mat.needsUpdate = true;
      });
    });
  }, [scene, threeScene.environment]);

  // Update envMap each frame in case the scene environment changes
  useFrame(() => {
    if (!threeScene.environment) return;
    scene.traverse((child: any) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((mat: any) => {
        if (mat.envMap !== threeScene.environment) {
          mat.envMap = threeScene.environment;
          mat.needsUpdate = true;
        }
      });
    });
  });

  // Subtle idle sway — kept separate from env update loop
  const swayFrame = useRef<number>(0);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.rotation.z =
      Math.sin(t * 0.4) * 0.008 + Math.sin(t * 0.17) * 0.005;
  });

  return (
    <group ref={groupRef} position={[8.6, 5.89, -4]} castShadow>
      {/* Three night fill lights distributed along the blade length so the
          whole face gets even, moonlight-blue illumination rather than a
          single pinpoint. All start at intensity 0 and are driven by the
          useFrame above. distance + decay are tuned so each light reaches
          its neighbours without bleeding too far onto the grass. */}
      <pointLight
        ref={nightLightTopRef}
        color={new THREE.Color(0.55, 0.65, 1.0)}
        intensity={1}
        distance={20}
        decay={-1}
        position={[4, 18, -1]}
      />
      <pointLight
        ref={nightLightMidRef}
        color={new THREE.Color(0.65, 0.65, 1.0)}
        intensity={0.45}
        distance={15}
        decay={0.24}
        position={[-7, 6, -4]}
      />
      <pointLight
        ref={nightLightBotRef}
        color={new THREE.Color(0.55, 0.65, 1.0)}
        intensity={2}
        distance={100}
        decay={1}
        position={[1, 9, 1]}
      />
      <primitive
        object={scene}
        rotation={
          new THREE.Euler(
            0,
            THREE.MathUtils.degToRad(27.9),
            THREE.MathUtils.degToRad(81.5),
            "YZX",
          )
        }
        scale={21.25}
        position={[0, -1, 2]}
      />
    </group>
  );
}
