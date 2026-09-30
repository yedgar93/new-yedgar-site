"use client";

import { useSyncExternalStore } from "react";
import { artReleases } from "@/world/assets/catalog";
import { interaction } from "@/world/store/interaction";

function hoveredIndex() {
  return interaction.get().hovered;
}

export function ReleaseLabel() {
  const index = useSyncExternalStore(interaction.subscribeHover, hoveredIndex, () => null);
  const release = index == null ? null : artReleases[index];
  if (!release) return null;

  return (
    <div className="absolute bottom-28 md:bottom-36 left-1/2 z-10 w-[min(92vw,36rem)] -translate-x-1/2 text-center pointer-events-none">
      <p className="text-[10px] tracking-[0.22em] uppercase text-fg-dim font-mono">
        {release.type} · {release.releaseDate}
        {release.tracks ? ` · ${release.tracks} tracks` : ""}
      </p>
      <p className="mt-1 text-[clamp(1.1rem,3vw,2rem)] font-medium tracking-tight text-fg">{release.title}</p>
      {release.label ? (
        <p className="mt-1 text-[10px] tracking-[0.18em] uppercase text-fg-muted font-mono">{release.label}</p>
      ) : null}
    </div>
  );
}
