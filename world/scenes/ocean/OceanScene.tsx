"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { sceneAtmosphere } from "@/world/store/atmosphere";
import type { QualitySettings } from "@/world/quality/tiers";
import { prepareNormalMap, setUniformTexture } from "@/world/runtime/mutations";
import { createFlatNormal, createOceanMaterial } from "@/world/scenes/ocean/OceanMaterial";
import { Ocean } from "@/world/scenes/ocean/Ocean";
import { Reflection } from "@/world/scenes/ocean/Reflection";
import { ReleaseRing } from "@/world/scenes/ocean/Cards";
import { useRingControls } from "@/world/scenes/ocean/useRingControls";

export default function OceanScene({ settings }: { settings: QualitySettings }) {
  useRingControls(true);
  const normalMap = useLoader(TextureLoader, "/waternormals.jpeg");
  const flat = useMemo(() => createFlatNormal(), []);
  const material = useMemo(
    () => createOceanMaterial(settings, normalMap ?? flat),
    [settings, normalMap, flat],
  );

  useLayoutEffect(() => {
    prepareNormalMap(normalMap);
    setUniformTexture(material, "uNormalMap", normalMap);
  }, [normalMap, material]);

  useEffect(() => {
    sceneAtmosphere.fogDensity = 0.01;
    sceneAtmosphere.exp2Density = 0.0065;
    sceneAtmosphere.cloudCoverage = 0.48;
    sceneAtmosphere.ground = "#241c3d";
    document.documentElement.style.setProperty("--ground", sceneAtmosphere.ground);
    return () => {
      material.dispose();
      flat.dispose();
    };
  }, [material, flat]);

  return (
    <group>
      <Ocean material={material} settings={settings} />
      {settings.ocean.reflection ? <Reflection material={material} /> : null}
      <Suspense fallback={null}>
        <ReleaseRing settings={settings} />
      </Suspense>
    </group>
  );
}
