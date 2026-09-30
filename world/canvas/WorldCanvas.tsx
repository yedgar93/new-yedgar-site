"use client";

import { useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { AgXToneMapping, NoToneMapping, SRGBColorSpace } from "three";
import { CameraDirector } from "@/world/camera/CameraDirector";
import { FrameTicker, QualityRuntime } from "@/world/canvas/QualityRuntime";
import { WorldClock } from "@/world/canvas/WorldClock";
import { Pipeline } from "@/world/pipeline/Pipeline";
import { quality } from "@/world/quality/qualityStore";
import { SceneHost } from "@/world/scenes/SceneHost";
import { interaction } from "@/world/store/interaction";

export default function WorldCanvas({ antialias }: { antialias: boolean }) {
  const settings = useSyncExternalStore(quality.subscribe, quality.get, quality.get).settings;

  return (
    <Canvas
      frameloop="demand"
      dpr={settings.dpr}
      gl={{
        antialias,
        alpha: false,
        stencil: false,
        powerPreference: "default",
        toneMapping: settings.composer ? NoToneMapping : AgXToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: 42, near: 0.15, far: 900, position: [0, 4.85, 12.6] }}
      onPointerMissed={() => interaction.setHovered(null)}
    >
      <WorldClock />
      <CameraDirector />
      <QualityRuntime />
      <FrameTicker />
      <SceneHost settings={settings} />
      <Pipeline settings={settings} />
    </Canvas>
  );
}
