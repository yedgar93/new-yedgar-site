"use client";

import { useEffect } from "react";
import { Grass } from "@/world/scenes/meadow/Grass";
import { Sword } from "@/world/scenes/meadow/Sword";
import { Terrain } from "@/world/scenes/meadow/Terrain";
import { sceneAtmosphere } from "@/world/store/atmosphere";
import type { QualitySettings } from "@/world/quality/tiers";

export default function MeadowScene({ settings }: { settings: QualitySettings }) {
  useEffect(() => {
    sceneAtmosphere.fogDensity = 0.0018;
    sceneAtmosphere.exp2Density = 0.0008;
    sceneAtmosphere.cloudCoverage = 0.42;
    sceneAtmosphere.ground = "#214628";
    document.documentElement.style.setProperty("--ground", sceneAtmosphere.ground);
  }, []);

  return (
    <group>
      <Terrain settings={settings} />
      <Grass settings={settings} />
      <Sword settings={settings} />
    </group>
  );
}
