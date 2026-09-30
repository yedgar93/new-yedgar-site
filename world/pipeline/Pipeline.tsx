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
            aoRadius={1.15}
            intensity={1.35}
            distanceFalloff={0.6}
          />
        ) : (
          <></>
        )}
        {dof ? (
          <DepthOfField worldFocusDistance={20} worldFocusRange={9} bokehScale={1.15} />
        ) : (
          <></>
        )}
        <Bloom
          mipmapBlur
          intensity={0.42}
          luminanceThreshold={0.78}
          luminanceSmoothing={0.2}
          levels={composer.bloomLevels}
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <gradeEffect />
        <Vignette eskil={false} offset={0.28} darkness={0.72} />
        <Noise opacity={0.18} />
        <SMAA />
      </>
    </EffectComposer>
  );
}
