"use client";

import { releases } from "@/data/releases";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CustomSoundCloudPlayer from "@/components/CustomSoundCloudPlayer";
import LazyMount from "@/components/LazyMount";
import { ArtTilt } from "@/components/ArtTilt";
import { interaction } from "@/world/store/interaction";

export default function MusicPage() {
  return (
    <Suspense fallback={null}>
      <MusicPageContent />
    </Suspense>
  );
}

function MusicPageContent() {
  const searchParams = useSearchParams();
  const trackParam = searchParams.get("track");

  const [activeIndex, setActiveIndex] = useState(() => {
    if (trackParam) {
      const index = releases.findIndex((r) => r.id === trackParam);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const active = releases[activeIndex];

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
    interaction.setActiveTrack(activeIndex);
  }, [active, activeIndex, updateURL]);

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

  return (
    <main
      className="view-full overflow-hidden animate-fade-in no-scrollbar"
      style={{ height: "100dvh", maxHeight: "100dvh", touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 55% at 50% 42%, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)",
        }}
      />
      <div className="grey-bg">
        <div className="relative flex flex-col items-center text-center px-4 md:px-6 z-10">
          {active.artwork && (
            <ArtTilt key={`art-${active.id}`}>
              <div
                className="w-36 h-36 md:w-56 md:h-56 shadow-lg mb-4 md:mb-8 flex items-center justify-center"
                style={{
                  pointerEvents: "auto",
                  WebkitTapHighlightColor: "transparent",
                  background: "#000",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            </ArtTilt>
          )}

          <p className="text-[12px] tracking-[0.1em] uppercase text-fg-bright text-gray-300 font-mono animate-fade-in delay-1 centermusic text-shadow-xs text-shadow-gray-800 ">
            {active.type} · {active.releaseDate}
            {active.tracks ? ` · ${active.tracks} tracks` : ""}
          </p>

          <h1
            key={active.id}
            className="mt-2 md:mt-3 text-[clamp(1.5rem,6vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-fg-bright text-gray-300 animate-scale-in text-shadow-2xs text-shadow-gray-800 centermusic "
          >
            {active.title}
          </h1>

          {active.label && (
            <p className="lg:mt-4 mt-3 text-[12px] tracking-[0.2em] uppercase text-fg-bright text-gray-300 animate-fade-in delay-2 centermusic text-shadow-2xs text-shadow-gray-800">
              {active.label}
            </p>
          )}

          <div className="mt-5 md:mt-8 flex items-center gap-4 md:gap-6 animate-scale-in delay-2 text-gray-300 text-fg-bright text-[13px] centermusic  text-shadow-xs ">
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

          {active.soundcloudUrl && (
            <div className="mt-4 md:mt-6 w-full max-w-sm md:max-w-md">
              <LazyMount>
                <CustomSoundCloudPlayer trackUrl={active.soundcloudUrl} shouldAutoPlay={false} />
              </LazyMount>
            </div>
          )}
        </div>
      </div>
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={release.artwork} alt={release.title} className="w-full h-full object-cover" />
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

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10 animate-fade-in delay-3">
        <span className="font-mono text-[10px] text-gray-300 tracking-wider text-shadow-2xs text-shadow-black centermusic">
          {String(activeIndex + 1).padStart(2, "0")} / {String(releases.length).padStart(2, "0")}
        </span>
      </div>
    </main>
  );
}
