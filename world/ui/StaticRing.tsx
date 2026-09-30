import { artReleases } from "@/world/assets/catalog";

/** No-WebGL stand-in. Same releases, same click-through to the music page. */
export function StaticRing() {
  return (
    <div className="static-ring" aria-hidden={false}>
      <div className="static-ring-tilt">
        {artReleases.map((release, index) => {
          const angle = (index / artReleases.length) * 360;
          return (
            <a
              key={release.id}
              href={`/music?track=${release.id}&autoplay=true`}
              style={{ transform: `rotateY(${angle}deg) translateZ(240px)` }}
              aria-label={release.title}
            >
              {release.artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={release.artwork} alt="" />
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
