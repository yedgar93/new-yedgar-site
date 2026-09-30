"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { worldTime } from "@/world/store/worldTime";
import { isWorldPath } from "@/world/routes";

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Writes world-time CSS variables. No React state, so the nav does not re-render per frame. */
export function useWorldCssVars() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const time = worldTime.get();
      const world = isWorldPath(pathname);
      const alwaysWhite = pathname === "/" || pathname === "/about";
      const plain = !world && pathname !== "/about";
      const white = alwaysWhite ? 1 : plain ? 0 : 1 - smoothstep(0.28, 0.62, time.dayFactor);
      root.style.setProperty("--logo-white", white.toFixed(3));
      root.style.setProperty("--day", time.dayFactor.toFixed(3));
      root.style.setProperty("--sky-top", time.skyTopCss);
      root.style.setProperty("--sky-horizon", time.skyHorizonCss);
      root.dataset.world = world ? "1" : "0";
      if (!world) {
        root.style.setProperty("--fg", "#2b2b2b");
        root.style.setProperty("--fg-dim", "#a0a0a0");
        root.style.setProperty("--fg-muted", "#6b6b6b");
        return;
      }
      const nightNav = time.dayFactor < 0.45;
      root.style.setProperty("--fg", nightNav ? "#f3f3f3" : "#2b2b2b");
      root.style.setProperty("--fg-dim", nightNav ? "rgba(255,255,255,0.72)" : "#5e5e5e");
      root.style.setProperty("--fg-muted", nightNav ? "rgba(255,255,255,0.88)" : "#6b6b6b");
    };
    apply();
    return worldTime.subscribe(apply);
  }, [pathname]);
}
