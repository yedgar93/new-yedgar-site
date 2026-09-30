"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { quality } from "@/world/quality/qualityStore";

export function QualityRuntime() {
  const boot = useRef(0);
  const lastStep = useRef(0);
  const setDpr = useThree((state) => state.setDpr);
  const settings = quality.getSettings();

  useEffect(() => {
    boot.current = performance.now();
  }, []);

  useEffect(() => {
    setDpr(quality.getSettings().dpr);
  }, [settings.dpr, setDpr]);

  return (
    <PerformanceMonitor
      ms={200}
      iterations={6}
      flipflops={0}
      bounds={(refresh) => {
        const current = quality.getSettings();
        if (current.software || (current.maxFps > 0 && current.maxFps <= 30)) return [22, 33];
        if (refresh > 80) return [70, 100];
        return [48, 58];
      }}
      onDecline={() => {
        const now = performance.now();
        if (boot.current === 0 || now - boot.current < 3000) return;
        const current = quality.getSettings();
        if (current.dpr > current.dprMin + 0.03) quality.setDpr(current.dpr - 0.12);
        if (now - lastStep.current < 8000) return;
        if (current.tier !== "high" && current.tier !== "medium") return;
        lastStep.current = now;
        quality.stepDown("fps");
      }}
    />
  );
}

export function FrameTicker() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden) return;
      const maxFps = quality.getSettings().maxFps;
      if (maxFps > 0 && last !== 0 && now - last < 1000 / maxFps) return;
      last = now;
      invalidate();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [invalidate]);

  return null;
}
