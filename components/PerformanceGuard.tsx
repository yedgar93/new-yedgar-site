"use client";

import { useEffect, useState } from "react";

export default function PerformanceGuard() {
  const [mode, setMode] = useState<"normal" | "low">("normal");

  useEffect(() => {
    let mounted = true;

    function setLow() {
      if (!mounted) return;
      setMode((m) => (m === "low" ? m : "low"));
    }

    function setNormal() {
      if (!mounted) return;
      setMode((m) => (m === "normal" ? m : "normal"));
    }

    // Heuristics: low device memory, few CPU cores, save-data, battery low/not charging
    try {
      // Allow override via URL: ?perf=low or ?perf=normal
      try {
        const q = new URLSearchParams(window.location.search);
        const qv = q.get("perf");
        if (qv === "low") {
          setLow();
        } else if (qv === "normal") {
          setNormal();
        }
      } catch (e) {
        // ignore
      }

      // Allow manual override for debugging: window.__PERF_FORCE_LOW = true
      // or window.__PERF_FORCE_NORMAL = true
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if ((window as any).__PERF_FORCE_LOW) setLow();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if ((window as any).__PERF_FORCE_NORMAL) setNormal();

      // Force low-performance mode on mobile / touch devices by default to
      // avoid mounting heavy WebGL canvases on phones which often have
      // constrained GPUs and aggressive background throttling.
      try {
        const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
        const isSmallScreen = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) <= 768;
        const prefersCoarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        if (isTouch || isSmallScreen || prefersCoarse) {
          setLow();
        }
      } catch (e) {}

      const mem = (navigator as any).deviceMemory;
      const hc = (navigator as any).hardwareConcurrency;
      // Be slightly more aggressive for low-power detection
      if (typeof mem === "number" && mem <= 2) setLow();
      if (typeof hc === "number" && hc <= 2) setLow();

      const nav: any = navigator;
      if (nav.connection && nav.connection.saveData) setLow();

      // Battery API
      if (nav.getBattery) {
        nav.getBattery().then((battery: any) => {
          if (!mounted) return;
          if (!battery.charging && battery.level <= 0.5) setLow();
          battery.addEventListener("levelchange", () => {
            if (!mounted) return;
            if (!battery.charging && battery.level <= 0.5) setLow();
            if (battery.charging || battery.level > 0.7) setNormal();
          });
          battery.addEventListener("chargingchange", () => {
            if (!mounted) return;
            if (battery.charging) setNormal();
            else if (battery.level <= 0.5) setLow();
          });
        });
      }
    } catch (e) {
      // swallow
    }

    // LongTask observer: if we see repeated long tasks, assume heavy CPU and lower visuals
    try {
      // @ts-ignore - PerformanceObserver may exist
      const obs = new (window as any).PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        const long = entries.filter((e: any) => e.duration && e.duration > 200).length;
        if (long >= 3) setLow();
      });
      obs.observe({ entryTypes: ["longtask"] });

      // Fallback: monitor event loop lag by measuring setTimeout drift
      let last = performance.now();
      const interval = setInterval(() => {
        const now = performance.now();
        const drift = now - last - 1000;
        last = now;
        if (drift > 200) setLow();
      }, 1000);

      return () => {
        mounted = false;
        try {
          obs.disconnect();
        } catch (e) {}
        clearInterval(interval);
      };
    } catch (e) {
      return () => {
        mounted = false;
      };
    }
  }, []);

  // Apply mode to document and notify listeners
  useEffect(() => {
    try {
      if (mode === "low") {
        document.documentElement.setAttribute("data-performance-mode", "low");
        document.body.classList.add("reduced-graphics");
        // suggest a capped DPR for components that read this CSS var
        document.documentElement.style.setProperty("--app-dpr", "1");
      } else {
        document.documentElement.setAttribute("data-performance-mode", "normal");
        document.body.classList.remove("reduced-graphics");
        document.documentElement.style.removeProperty("--app-dpr");
      }
      window.dispatchEvent(new CustomEvent("performance:mode", { detail: mode }));
    } catch (e) {
      // ignore
    }
  }, [mode]);

  return null;
}
