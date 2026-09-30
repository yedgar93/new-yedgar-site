"use client";

import { useEffect, useRef } from "react";
import { perfStats, publishPerfStats } from "@/world/debug/perfStats";
import { quality } from "@/world/quality/qualityStore";
import { worldTime } from "@/world/store/worldTime";

/**
 * Software-renderer presentation. A full-resolution still of the scene, with a
 * day/night crossfade, a little parallax, and a cheap shimmer. No three.js.
 */
export function StillStage({ scene }: { scene: "ocean" | "meadow" }) {
  const root = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const frame = root.current;
    const nightImg = night.current;
    if (!frame || !nightImg) return;
    const reduced = quality.getSettings().reducedMotion;
    const applyNight = () => {
      nightImg.style.opacity = String(1 - worldTime.get().dayFactor);
    };
    applyNight();
    const unsubscribe = worldTime.subscribe(applyNight);

    const onPointer = (event: PointerEvent) => {
      if (reduced) return;
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      frame.style.transform = `translate3d(${(-x * 10).toFixed(2)}px, ${(y * 6).toFixed(2)}px, 0)`;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let last = performance.now();
    let frames = 0;
    let raf = 0;
    const loop = (now: number) => {
      const ms = now - last;
      last = now;
      frames += 1;
      perfStats.ready = frames > 10;
      perfStats.frames = frames;
      perfStats.ms = ms;
      perfStats.fps = 1000 / Math.max(ms, 0.01);
      perfStats.tier = "static";
      perfStats.dpr = 1;
      perfStats.calls = 0;
      perfStats.tris = 0;
      perfStats.renderer = quality.get().renderer;
      perfStats.software = true;
      publishPerfStats();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      unsubscribe();
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`still-stage still-${scene}`} data-reduced={quality.getSettings().reducedMotion ? "1" : "0"}>
      <div className="still-frame" ref={root}>
        {/* Full-bleed scene stills. next/image would letterbox and preload on plain routes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="still-day" src={`/stills/${scene}-day.webp`} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={night}
          className="still-night"
          src={`/stills/${scene}-night.webp`}
          alt=""
          draggable={false}
          style={{ opacity: 1 - worldTime.get().dayFactor }}
        />
        <div className="still-shimmer" />
      </div>
    </div>
  );
}
