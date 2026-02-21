"use client";

import { useEffect, useState } from "react";

export function usePerformance() {
  const [mode, setMode] = useState<"normal" | "low">(() => {
    try {
      const attr = typeof document !== "undefined" ? document.documentElement.getAttribute("data-performance-mode") : null;
      return (attr as any) || "normal";
    } catch (e) {
      return "normal";
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as "normal" | "low";
      if (detail) setMode(detail);
    };
    window.addEventListener("performance:mode", handler as EventListener);
    return () => window.removeEventListener("performance:mode", handler as EventListener);
  }, []);

  function getDPR() {
    try {
      const css = getComputedStyle(document.documentElement).getPropertyValue("--app-dpr");
      const val = css ? parseFloat(css) : NaN;
      if (!isNaN(val)) return val;
      return window.devicePixelRatio || 1;
    } catch (e) {
      return 1;
    }
  }

  return { mode, isLow: mode === "low", dpr: getDPR() };
}
