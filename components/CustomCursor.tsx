"use client";

import { useEffect, useRef } from "react";
import { usePerformance } from "./usePerformance";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const perf = usePerformance();

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const mouse = { x: -200, y: -200 };
    const pos = { x: -200, y: -200 };
    let attractTarget: { x: number; y: number } | null = null;
    let isHovering = false;
    let isMouseActive = true;
    let currentOpacity = 0.9;
    let targetOpacity = 0.9;
    let raf: number;

    // Hide system cursor
    const style = document.createElement("style");
    style.textContent = "*, *::before, *::after { cursor: none !important; }";
    document.head.appendChild(style);

    // Track mouse position and whether we're over an iframe (done on mousemove, not per-frame)
    const isOverIframeRef = { current: false } as { current: boolean };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      // Determine iframe presence here (event-driven) to avoid calling elementFromPoint each animation frame
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      isOverIframeRef.current = elementUnderMouse?.tagName === "IFRAME";
    };

    const onMouseOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        "a, button, [role='button'], input[type='submit'], label[for]",
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      attractTarget = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      isHovering = true;
    };

    const onMouseOut = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        "a, button, [role='button'], input[type='submit'], label[for]",
      );
      if (!el) return;
      const related = e.relatedTarget as HTMLElement | null;
      if (related && el.contains(related)) return;
      attractTarget = null;
      isHovering = false;
    };

    const onMouseEnter = () => {
      isMouseActive = true;
    };

    const onMouseLeave = () => {
      isMouseActive = false;
    };

    const animate = () => {
      // Update target opacity based on mouse activity and iframe flag (set from mousemove)
      if (!isMouseActive) {
        targetOpacity = 0;
      } else {
        targetOpacity = isOverIframeRef.current ? 0 : 0.9;
      }

      // Smooth opacity transition
      currentOpacity += (targetOpacity - currentOpacity) * 0.15;
      cursor.style.opacity = String(currentOpacity);

      const targetX = attractTarget
        ? mouse.x + (attractTarget.x - mouse.x) * 0.85
        : mouse.x;
      const targetY = attractTarget
        ? mouse.y + (attractTarget.y - mouse.y) * 0.85
        : mouse.y;

      pos.x += (targetX - pos.x) * (isHovering ? 0.18 : 0.12);
      pos.y += (targetY - pos.y) * (isHovering ? 0.18 : 0.12);

      const size = isHovering ? 40 : 16;
      cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
      cursor.style.width = `${size}px`;
      cursor.style.height = `${size}px`;

      // Use a lower-frequency update loop on low-power mode to save CPU
      if (perf.isLow) return; // when using interval, don't queue another RAF
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);

    let intervalId: number | null = null;
    if (perf.isLow) {
      // Run at ~15 FPS with setInterval
      intervalId = window.setInterval(animate, 66) as unknown as number;
    } else {
      raf = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseenter", onMouseEnter);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      cancelAnimationFrame(raf);
      if (intervalId) window.clearInterval(intervalId);
      document.head.removeChild(style);
    };
  }, [perf.isLow]);

  return (
    <div
      ref={cursorRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        mixBlendMode: "difference",
        pointerEvents: "none",
        zIndex: 99999,
        transition:
          "width 0.3s cubic-bezier(0.25,0.46,0.45,0.94), height 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
        willChange: "transform",
      }}
    />
  );
}
