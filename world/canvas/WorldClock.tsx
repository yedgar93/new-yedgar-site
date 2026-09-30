"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { perfStats, publishPerfStats } from "@/world/debug/perfStats";
import { applyRenderer } from "@/world/pipeline/renderer";
import { watchRender } from "@/world/runtime/mutations";
import { quality } from "@/world/quality/qualityStore";
import { syncWorldUniforms } from "@/world/store/uniforms";
import { worldTime } from "@/world/store/worldTime";

export function WorldClock() {
  const gl = useThree((state) => state.gl);
  const primed = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      quality.noteContextLoss();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    watchRender(gl);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl]);

  useFrame((state) => {
    const now = performance.now();
    if (!primed.current) {
      primed.current = true;
      last.current = now;
      applyRenderer(state.gl, quality.getSettings());
      return;
    }
    const raw = (now - last.current) / 1000;
    const dt = Math.min(0.05, Math.max(0, raw));
    last.current = now;
    const settings = quality.getSettings();
    applyRenderer(state.gl, settings);
    worldTime.tick(dt);
    syncWorldUniforms(state.gl, state.size.width, state.size.height);

    const info = state.gl.info.render;
    perfStats.calls = info.calls;
    perfStats.tris = info.triangles;
    perfStats.frames += 1;
    perfStats.ms = raw * 1000;
    perfStats.fps = raw > 0 ? 1 / raw : 0;
    perfStats.tier = settings.tier;
    perfStats.dpr = state.gl.getPixelRatio();
    perfStats.software = settings.software;
    if (perfStats.frames === 8) {
      const context = state.gl.getContext();
      const ext = context.getExtension("WEBGL_debug_renderer_info");
      perfStats.renderer = ext ? String(context.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    }
    if (perfStats.frames >= 15) perfStats.ready = true;
    publishPerfStats();
  }, -2);

  return null;
}
