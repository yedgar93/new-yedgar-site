"use client";

import { useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { attachFog, syncFog } from "@/world/runtime/sceneBindings";

export function SceneFog() {
  const scene = useThree((state) => state.scene);

  useLayoutEffect(() => attachFog(scene), [scene]);

  useFrame(() => {
    syncFog(scene);
  });

  return null;
}
