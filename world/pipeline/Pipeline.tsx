"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { HalfFloatType, UnsignedByteType } from "three";
import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { extend } from "@react-three/fiber";
import { GradeEffect } from "@/world/pipeline/gradeEffect";
import { supportsHalfFloat } from "@/world/pipeline/renderer";
import type { QualitySettings } from "@/world/quality/tiers";
import { transition } from "@/world/store/transition";
import { useSyncExternalStore } from "react";

extend({ GradeEffect });

export function Pipeline({ settings }: { settings: QualitySettings }) {
  const gl = useThree((state) => state.gl);
  const composer = settings.composer;
  const scene = useSyncExternalStore(transition.subscribe, transition.get, transition.get);
  const half = useMemo(() => supportsHalfFloat(gl), [gl]);
  if (!composer) return null;

  const meadow = scene.scene === "meadow";
  const ao = composer.ao && meadow;
  const dof = composer.dof && meadow;

  return (
    <EffectComposer
      multisampling={composer.multisampling}
      frameBufferType={composer.halfFloat && half ? HalfFloatType : UnsignedByteType}
      enableNormalPass={ao}
      renderPriority={1}
    >
      <>
        {ao ? (
          <N8AO
            halfRes
            quality="performance"
            aoRadius={0.7}
            intensity={0.65}
            distanceFalloff={0.6}
          />
        ) : (
          <></>
        )}
        {dof ? (
          <DepthOfField worldFocusDistance={28} worldFocusRange={18} bokehScale={0.4} />
        ) : (
          <></>
        )}
        <Bloom
          mipmapBlur
          intensity={0.22}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.25}
          levels={composer.bloomLevels}
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <gradeEffect />
        <Vignette eskil={false} offset={0.45} darkness={0.35} />
        <Noise opacity={0.045} />
        <SMAA />
      </>
    </EffectComposer>
  );
}
