"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isWorldPath, sceneForPath } from "@/world/routes";
import { bootQuality, quality } from "@/world/quality/qualityStore";
import { useWorldCssVars } from "@/world/store/cssVars";
import { transition } from "@/world/store/transition";
import { DebugHud, PointerBridge } from "@/world/ui/PointerBridge";
import { StaticRing } from "@/world/ui/StaticRing";

const WorldCanvas = dynamic(() => import("@/world/canvas/WorldCanvas"), { ssr: false });

export function WorldRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  useWorldCssVars();
  const snap = useSyncExternalStore(quality.subscribe, quality.get, quality.get);
  const world = isWorldPath(pathname);
  const showCanvas = world && snap.ready && snap.tier !== "static";

  useLayoutEffect(() => {
    bootQuality();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.world = world ? "1" : "0";
    if (!showCanvas) {
      transition.setScene("plain");
      return;
    }
    const scene = sceneForPath(pathname);
    if (scene) transition.request(scene);
  }, [pathname, showCanvas, world]);

  return (
    <>
      <div className="world-stage" data-active={world ? "1" : "0"}>
        <div className="world-backdrop" />
        {showCanvas ? <WorldCanvas antialias={snap.settings.nativeAntialias} /> : null}
        {world && snap.ready && snap.tier === "static" && pathname === "/" ? <StaticRing /> : null}
      </div>
      <PointerBridge />
      <DebugHud />
      <div className="page-layer">{children}</div>
    </>
  );
}
