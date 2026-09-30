"use client";

import { lazy, Suspense } from "react";
import { useSyncExternalStore } from "react";
import { Atmosphere } from "@/world/atmosphere/Atmosphere";
import { CelestialLights } from "@/world/atmosphere/CelestialLights";
import { CursorField } from "@/world/atmosphere/CursorField";
import { EnvProbe } from "@/world/atmosphere/EnvProbe";
import { SceneFog } from "@/world/atmosphere/SceneFog";
import type { QualitySettings } from "@/world/quality/tiers";
import { transition } from "@/world/store/transition";

const OceanScene = lazy(() => import("@/world/scenes/ocean/OceanScene"));
const MeadowScene = lazy(() => import("@/world/scenes/meadow/MeadowScene"));

function subscribe(listener: () => void) {
  return transition.subscribe(listener);
}

export function SceneHost({ settings }: { settings: QualitySettings }) {
  const snapshot = useSyncExternalStore(subscribe, transition.get, transition.get);

  return (
    <>
      <Atmosphere settings={settings} />
      <CelestialLights />
      <SceneFog />
      <EnvProbe settings={settings} />
      <CursorField />
      <Suspense fallback={null}>
        {snapshot.scene === "ocean" ? <OceanScene settings={settings} /> : null}
        {snapshot.scene === "meadow" ? <MeadowScene settings={settings} /> : null}
      </Suspense>
    </>
  );
}
