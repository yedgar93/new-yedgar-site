"use client";

import { useEffect, useMemo } from "react";
import type { ShaderMaterial } from "three";
import { createOceanGeometry } from "@/world/scenes/ocean/OceanMaterial";
import type { QualitySettings } from "@/world/quality/tiers";

export function Ocean({ material, settings }: { material: ShaderMaterial; settings: QualitySettings }) {
  const geometry = useMemo(
    () => createOceanGeometry(settings.ocean.segments),
    [settings.ocean.segments],
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
