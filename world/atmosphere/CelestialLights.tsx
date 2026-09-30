"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { DirectionalLight, HemisphereLight } from "three";
import { worldUniforms } from "@/world/store/uniforms";

export function CelestialLights() {
  const sun = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);

  useFrame(() => {
    const sunDir = worldUniforms.uSunDir.value;
    const moonDir = worldUniforms.uMoonDir.value;
    if (sun.current) {
      sun.current.position.set(sunDir.x * 40, Math.max(0.2, sunDir.y) * 40, sunDir.z * 40);
      sun.current.intensity = 2.6 * worldUniforms.uSunVis.value;
      sun.current.color.copy(worldUniforms.uSunColor.value);
    }
    if (moon.current) {
      moon.current.position.set(moonDir.x * 30, Math.max(0.2, moonDir.y) * 30, moonDir.z * 30);
      moon.current.intensity = 1.35 * worldUniforms.uNight.value;
      moon.current.color.copy(worldUniforms.uMoonColor.value);
    }
    if (hemi.current) {
      hemi.current.intensity = 0.42 + worldUniforms.uNight.value * 0.35;
      hemi.current.color.copy(worldUniforms.uAmbientSky.value);
      hemi.current.groundColor.copy(worldUniforms.uAmbientGround.value);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#8aa4c4", "#2a241c", 0.5]} />
      <directionalLight ref={sun} position={[10, 20, 8]} intensity={3} />
      <directionalLight ref={moon} position={[-10, 12, -6]} intensity={0.2} color="#9eb6ff" />
    </>
  );
}
