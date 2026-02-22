"use client";

import dynamic from "next/dynamic";
import LazyMount from "@/components/LazyMount";

const Carousel3D = dynamic(() => import("@/components/Carousel3D"), {
  ssr: false,
});

// const OceanBackground = dynamic(() => import("@/components/OceanBackground"), {
//   ssr: false,
// });

export default function Home() {
  return (
    <main className="view-full relative overflow-hidden animate-fade-in">
      {/* Ocean water shader background */}
      {/* <OceanBackground /> */}

      {/* 3D Carousel — fills entire viewport (lazy-mount) */}
      <LazyMount
        placeholder={
          <div className="canvas-placeholder carousel-placeholder" />
        }
      >
        <Carousel3D />
      </LazyMount>

      {/* Overlay: Artist name bottom-left */}
      <div className="absolute bottom-20 md:bottom-24 left-6 md:left-10 z-10 pointer-events-none animate-fade-in">
        {/* <h1 className="text-[clamp(2rem,6vw,5rem)] font-bold leading-[0.85] tracking-tighter text-fg/80">
          YEDGAR
        </h1> */}

        {/* <p className="mt-2 text-[10px] tracking-[0.3em] uppercase text-fg-dim font-mono">
          {siteMetadata.tagline}
        </p> */}
      </div>

      {/* Overlay: Scroll hint bottom-center */}
      <div className="absolute bottom-16 md:bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-fade-in delay-4">
        <p className="hidden md:block text-[10px] tracking-[-0.05em] uppercase text-fg-dim font-mono">
          Scroll up & down to rotate · Click to listen
        </p>
        <p className="block md:hidden text-[10px] tracking-[-0.05em] uppercase text-fg-dim font-mono">
          Swipe to browse · Tap to listen
        </p>
      </div>
    </main>
  );
}
