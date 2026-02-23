"use client";

import dynamic from "next/dynamic";
import { releases } from "@/data/releases";
import { useState, memo, useEffect, useRef, useCallback } from "react";
import VanillaTilt from "vanilla-tilt";
import { useResizeObserver } from "@/utils/useResizeObserver";
import { useSearchParams } from "next/navigation";
import CustomSoundCloudPlayer from "@/components/CustomSoundCloudPlayer";
import LazyMount from "@/components/LazyMount";
import { Suspense } from "react";

const GrassBackground = memo(
  dynamic(() => import("@/components/GrassBackground"), { ssr: false }),
);

export default function MusicPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MusicPageContent />
    </Suspense>
  );
}

function MusicPageContent() {
  const artworkRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchParams = useSearchParams();
  const active = releases[activeIndex];

  // Helper to (re)initialize VanillaTilt
  const initTilt = useCallback(() => {
    const node = artworkRef.current as
      | (HTMLDivElement & { vanillaTilt?: any })
      | null;
    if (node) {
      if (node.vanillaTilt) node.vanillaTilt.destroy();
      VanillaTilt.init(node, {
        max: 15,
        speed: 100,
        glare: true,
        "max-glare": 0.4,
        scale: 1.0,
        gyroscope: true,
        perspective: 800,
        reset: true,
        axis: null,
      });
    }
  }, []);

  // Re-init tilt on active artwork change
  useEffect(() => {
    initTilt();
    return () => {
      const node = artworkRef.current as
        | (HTMLDivElement & { vanillaTilt?: any })
        | null;
      if (node && node.vanillaTilt) node.vanillaTilt.destroy();
    };
  }, [active.id, initTilt]);

  // Re-init tilt on resize
  useResizeObserver(artworkRef as React.RefObject<Element>, initTilt);

  // Reactively update activeIndex when ?track= changes
  useEffect(() => {
    const trackId = searchParams.get("track");
    if (trackId) {
      const index = releases.findIndex((r) => r.id === trackId);
      if (index >= 0) setActiveIndex(index);
    }
  }, [searchParams]);

  const updateURL = useCallback((trackId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("track", trackId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  useEffect(() => {
    if (active) {
      updateURL(active.id);
    }
  }, [active, updateURL]);

  const n = releases.length;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          setActiveIndex((prev) => (prev + 1) % n);
        } else {
          setActiveIndex((prev) => (prev - 1 + n) % n);
        }
      }
    },
    [n],
  );

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setActiveIndex((prev) => (prev + 1) % n);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setActiveIndex((prev) => (prev - 1 + n) % n);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [n]);

  const progress = n > 1 ? activeIndex / (n - 1) : 0;

  // Prevent body scroll on this page
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = "#000000";
    return () => {
      document.body.style.overflow = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  return (
    <main
      className="view-full overflow-hidden animate-fade-in no-scrollbar"
      style={{ height: "100dvh", maxHeight: "100dvh", touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D grass background (lazy-mount) */}
      <LazyMount
        placeholder={<div className="canvas-placeholder grass-placeholder" />}
      >
        <GrassBackground progress={progress} />
      </LazyMount>

      {/* Center release display */}
      <div className="relative flex flex-col items-center text-center px-4 md:px-6 z-10">
        {/* Artwork */}
        {active.artwork && (
          <div
            key={`art-${active.id}`}
            ref={artworkRef}
            className="w-36 h-36 md:w-56 md:h-56 shadow-lg  mb-4 md:mb-8 flex items-center justify-center"
            style={{
              perspective: "800px",
              pointerEvents: "auto",
              WebkitTapHighlightColor: "transparent",
              background: "#000",
            }}
          >
            <img
              src={active.artwork}
              alt={active.title}
              className="w-full h-full object-cover"
              style={{
                pointerEvents: "none",
                userSelect: "none",
                display: "block",
                borderRadius: 0,
              }}
              draggable={false}
            />
          </div>
        )}

        {/* Release type label */}
        <p className="text-[10px] tracking-[0.3em] uppercase text-fg-bright text-gray-200 font-mono animate-fade-in delay-1">
          {active.type} · {active.releaseDate}
          {active.tracks ? ` · ${active.tracks} tracks` : ""}
        </p>

        {/* Title — large */}
        <h1
          key={active.id}
          className="mt-2 md:mt-3 text-[clamp(1.5rem,6vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-fg-bright text-gray-300 animate-scale-in"
        >
          {active.title}
        </h1>

        {/* Label */}
        {active.label && (
          <p className="lg:mt-4 mt-3 text-[11px] tracking-[0.2em] uppercase text-fg-bright text-gray-300 animate-fade-in delay-2">
            {active.label}
          </p>
        )}

        {/* Streaming links */}
        <div className="mt-5 md:mt-8 flex items-center gap-4 md:gap-6 animate-scale-in delay-2 text-gray-300 text-fg-bright text-[13px]">
          {active.spotifyUrl && (
            <a
              href={active.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-bright hover:text-fg"
            >
              Spotify
            </a>
          )}
          {active.soundcloudUrl && (
            <a
              href={active.soundcloudUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-bright hover:text-fg"
            >
              SoundCloud
            </a>
          )}
          {active.bandcampUrl && (
            <a
              href={active.bandcampUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-bright hover:text-fg"
            >
              Bandcamp
            </a>
          )}
        </div>

        {/* Custom SoundCloud Player */}
        {active.soundcloudUrl && (
          <div className="mt-4 md:mt-6 w-full max-w-sm md:max-w-md">
            <LazyMount>
              <CustomSoundCloudPlayer
                key={active.soundcloudUrl}
                trackUrl={active.soundcloudUrl}
                shouldAutoPlay={false}
              />
            </LazyMount>
          </div>
        )}

        {/* Removed SoundCloud embed */}
      </div>

      {/* Bottom navigation — release thumbnails */}
      <div className="absolute bottom-12 md:bottom-16 left-1/2 -translate-x-1/2 z-10 max-w-[98vw]">
        <div className="flex items-center gap-1.5 md:gap-2 animate-fade-in delay-4 overflow-x-auto pb-2">
          {releases.map((release, i) => (
            <button
              key={release.id}
              onClick={() => setActiveIndex(i)}
              className={`group relative shrink-0 w-9 h-9 md:w-11 md:h-11 transition-all duration-300 overflow-hidden cursor-pointer ${
                i === activeIndex
                  ? "ring-1 ring-fg/30 scale-110"
                  : "opacity-40 hover:opacity-80 hover:scale-105"
              }`}
              aria-label={release.title}
            >
              {release.artwork ? (
                <img
                  src={release.artwork}
                  alt={release.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: release.color || "#d8d8d8" }}
                >
                  <span className="text-white text-[7px] font-bold uppercase tracking-wider opacity-80">
                    {release.title.slice(0, 2)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Track counter */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10 animate-fade-in delay-3">
        <span className="font-mono text-[10px] text-fg tracking-wider">
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(releases.length).padStart(2, "0")}
        </span>
      </div>

      <style jsx>{`
        .soundcloud-embed {
          margin-top: 1.5rem;
          max-width: 100%;
          border-radius: 0px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </main>
  );
}
