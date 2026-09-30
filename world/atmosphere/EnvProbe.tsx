"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, PMREMGenerator, Scene, SphereGeometry, WebGLRenderTarget } from "three";
import { createProbeSkyMaterial } from "@/world/atmosphere/SkyMaterial";
import type { QualitySettings } from "@/world/quality/tiers";
import { publishEnvironment } from "@/world/runtime/mutations";
import { worldUniforms } from "@/world/store/uniforms";

export function EnvProbe({ settings }: { settings: QualitySettings }) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const probe = useMemo(() => {
    const probeScene = new Scene();
    const geometry = new SphereGeometry(40, 16, 12);
    const material = createProbeSkyMaterial(settings.skyOctaves);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    probeScene.add(mesh);
    return { probeScene, geometry, material };
  }, [settings.skyOctaves]);
  const pmrem = useMemo(() => new PMREMGenerator(gl), [gl]);
  const last = useRef(-999);
  const size = useRef(0);
  const current = useRef<WebGLRenderTarget | null>(null);

  useEffect(() => {
    pmrem.compileCubemapShader();
    return () => {
      current.current?.dispose();
      pmrem.dispose();
      probe.material.dispose();
      probe.geometry.dispose();
      publishEnvironment(scene, null, 0);
    };
  }, [pmrem, probe, scene]);

  useFrame(() => {
    const now = worldUniforms.uTime.value;
    const sizeChanged = size.current !== settings.envSize;
    if (!sizeChanged && current.current && now - last.current < settings.envInterval) return;
    last.current = now;
    size.current = settings.envSize;
    const next = pmrem.fromScene(probe.probeScene, 0, 0.1, 80, { size: settings.envSize });
    const previous = current.current;
    current.current = next;
    publishEnvironment(scene, next.texture, worldUniforms.uDay.value);
    previous?.dispose();
  });

  return null;
}
