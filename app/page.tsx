import { ReleaseLabel } from "@/world/ui/ReleaseLabel";

export default function Home() {
  return (
    <div className="relative min-h-dvh pointer-events-none">
      <ReleaseLabel />
      <div className="absolute bottom-16 md:bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-fade-in delay-4">
        <p className="hidden pointer-fine:block text-[10px] tracking-[-0.05em] uppercase text-fg-dim font-mono">
          Scroll up & down to rotate · Click to listen
        </p>
        <p className="block pointer-fine:hidden text-[10px] tracking-[-0.05em] uppercase text-fg-dim font-mono">
          Swipe to browse · Tap to listen
        </p>
      </div>
    </div>
  );
}
