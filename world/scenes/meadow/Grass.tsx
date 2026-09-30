"use client";

import { useEffect, useMemo } from "react";
import { InstancedMesh, StaticDrawUsage } from "three";
import { buildGrassChunks, createGrassMaterial } from "@/world/scenes/meadow/grassChunks";
import type { QualitySettings } from "@/world/quality/tiers";

export function Grass({ settings }: { settings: QualitySettings }) {
  const material = useMemo(() => createGrassMaterial(settings), [settings]);
  const meshes = useMemo(() => {
    const chunks = buildGrassChunks(
      settings.grass.blades,
      settings.grass.radius,
      settings.grass.segments,
      settings.grass.height,
      settings.grass.width,
      settings.grass.tuft,
    );
    return chunks.map((chunk) => {
      const mesh = new InstancedMesh(chunk.geometry, material, chunk.count);
      (mesh.instanceMatrix.array as Float32Array).set(chunk.matrices);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceMatrix.setUsage(StaticDrawUsage);
      mesh.count = chunk.count;
      mesh.frustumCulled = true;
      return mesh;
    });
  }, [material, settings]);

  useEffect(() => {
    return () => {
      material.dispose();
      meshes.forEach((mesh) => mesh.geometry.dispose());
    };
  }, [material, meshes]);

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}
