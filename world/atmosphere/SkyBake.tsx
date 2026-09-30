"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Scene, SphereGeometry } from "three";
import { createSkyMaterial } from "@/world/atmosphere/SkyMaterial";
import { disposeSkyCube, renderSkyToCube } from "@/world/atmosphere/skyBake";
import { worldUniforms } from "@/world/store/uniforms";

/** Software tier: clouds and the gradient are shaded into a cubemap, then sampled. */
export function SkyBake({ enabled }: { enabled: boolean }) {
  const gl = useThree((state) => state.gl);
  const bake = useMemo(() => {
    const skyScene = new Scene();
    const material = createSkyMaterial(4, false, false, true, false);
    const geometry = new SphereGeometry(30, 24, 16);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    skyScene.add(mesh);
    return { skyScene, material, geometry };
  }, []);
  const last = useRef(-999);
  const lastDay = useRef(-1);

  useEffect(() => {
    return () => {
      disposeSkyCube();
      bake.material.dispose();
      bake.geometry.dispose();
    };
  }, [bake]);

  useFrame(() => {
    if (!enabled) return;
    const now = worldUniforms.uTime.value;
    const day = worldUniforms.uDay.value;
    const due =
      worldUniforms.uHasSkyMap.value < 0.5 ||
      Math.abs(day - lastDay.current) > 0.04 ||
      now - last.current > 6;
    if (!due) return;
    last.current = now;
    lastDay.current = day;
    renderSkyToCube(gl, bake.skyScene);
  }, -1);

  return null;
}
