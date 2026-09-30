"use client";

import { useEffect } from "react";
import { interaction } from "@/world/store/interaction";

export function useRingControls(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let dragging = false;
    let lastX = 0;
    let moved = 0;

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = Math.max(-140, Math.min(140, event.deltaY));
      interaction.addRing(delta * 0.0015);
    };
    const down = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a, button, input, textarea")) return;
      dragging = true;
      moved = 0;
      lastX = event.clientX;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      moved += Math.abs(dx);
      interaction.addRing(-dx * 0.0055);
    };
    const up = () => {
      if (moved > 8) {
        interaction.setSuppressClick(true);
        window.setTimeout(() => interaction.setSuppressClick(false), 40);
      }
      dragging = false;
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") interaction.addRing(0.22);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") interaction.addRing(-0.22);
    };

    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
  }, [active]);
}
