"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Pointer tilt for album art. No dependency, and it stays still on touch and reduced motion. */
export function ArtTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const glare = node.querySelector<HTMLElement>(".art-glare");
    const move = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      node.style.transform = `rotateX(${(-y * 14).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg)`;
      if (!glare) return;
      glare.style.opacity = "1";
      glare.style.background = `radial-gradient(circle at ${((x + 0.5) * 100).toFixed(1)}% ${((y + 0.5) * 100).toFixed(1)}%, rgba(255,255,255,0.38), transparent 58%)`;
    };
    const leave = () => {
      node.style.transform = "rotateX(0deg) rotateY(0deg)";
      if (glare) glare.style.opacity = "0";
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={ref} className="art-tilt">
      {children}
      <span className="art-glare" />
    </div>
  );
}
