"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { interaction } from "@/world/store/interaction";
import { transition } from "@/world/store/transition";

/** Projects the page pointer onto the active ground plane for lanterns and grass push. */
export function CursorField() {
  const camera = useThree((state) => state.camera);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const pointer = interaction.get();
    const scene = transition.get().scene;
    const height = scene === "meadow" ? 5 : 0.15;
    plane.set(plane.normal, -height);
    ndc.set(pointer.pointerX, pointer.pointerY);
    raycaster.setFromCamera(ndc, camera);
    const found = raycaster.ray.intersectPlane(plane, hit);
    if (!found) {
      interaction.setCursor(0, height, 0, 0);
      return;
    }
    interaction.setCursor(hit.x, height, hit.z, 1);
  });

  return null;
}
