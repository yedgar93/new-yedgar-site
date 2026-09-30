"use client";

import { useEffect, useRef } from "react";
import { readParams } from "@/world/debug/params";
import { perfStats } from "@/world/debug/perfStats";
import { interaction } from "@/world/store/interaction";
import { worldTime } from "@/world/store/worldTime";

export function PointerBridge() {
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      interaction.setPointer((event.clientX / width) * 2 - 1, -((event.clientY / height) * 2 - 1));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return null;
}

export function DebugHud() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!readParams().debug) return;
    const node = ref.current;
    if (!node) return;
    node.hidden = false;
    const id = window.setInterval(() => {
      const time = worldTime.get();
      node.textContent = [
        perfStats.tier,
        perfStats.software ? "software" : "gpu",
        `${perfStats.fps.toFixed(0)} fps`,
        `${perfStats.ms.toFixed(1)} ms`,
        `dpr ${perfStats.dpr.toFixed(2)}`,
        `t ${time.timeOfDay.toFixed(3)}`,
        perfStats.renderer,
      ].join(" · ");
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return <div ref={ref} hidden className="debug-hud" />;
}
