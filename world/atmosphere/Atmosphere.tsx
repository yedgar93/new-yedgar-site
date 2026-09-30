"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { createSkyMaterial } from "@/world/atmosphere/SkyMaterial";
import type { QualitySettings } from "@/world/quality/tiers";

export function Atmosphere({ settings }: { settings: QualitySettings }) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () => createSkyMaterial(settings.skyOctaves, settings.ldrOutput, settings.skyBake),
    [settings.skyOctaves, settings.ldrOutput, settings.skyBake],
  );

  useEffect(() => {
    const node = mesh.current;
    if (!node) return;
    node.layers.enable(0);
    node.layers.enable(2);
    return () => material.dispose();
  }, [material]);

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[420, 28, 18]} />
    </mesh>
  );
}
