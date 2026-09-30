"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Euler, MathUtils, Mesh, MeshStandardMaterial } from "three";
import type { Group } from "three";
import { bindFinish } from "@/world/pipeline/finish";
import type { QualitySettings } from "@/world/quality/tiers";
import { worldUniforms } from "@/world/store/uniforms";

const REST = new Euler(0, MathUtils.degToRad(27.9), MathUtils.degToRad(81.5), "YZX");

export function Sword({ settings }: { settings: QualitySettings }) {
  const { scene } = useGLTF("/buster.glb");
  const group = useRef<Group>(null);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return;
        material.envMapIntensity = 1.15;
        if (material.emissive.getHex() !== 0) {
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.45);
        }
        bindFinish(material, settings.ldrOutput);
      });
    });
  }, [scene, settings.ldrOutput]);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const t = worldUniforms.uTime.value;
    node.rotation.z = Math.sin(t * 0.4) * 0.008 + Math.sin(t * 0.17) * 0.005;
  });

  return (
    <group ref={group} position={[8.6, 5.89, -4]}>
      <primitive object={scene} rotation={REST} scale={21.25} position={[0, -1, 2]} />
    </group>
  );
}
