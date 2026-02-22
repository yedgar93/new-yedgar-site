import { siteMetadata } from "@/data/metadata";

export const metadata = {
  title: "About — YEDGAR",
  description: "Biography and press information for YEDGAR",
};

export default function AboutPage() {
  return (
    <main className="view-full no-scroll about-page animate-fade-in delay-3">
      {/* Background video */}
      <video
        src="/video.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 50% overlay so text stays readable */}
      <div className="absolute inset-0 bg-[#2f1d42]/55" />

      <div
        className="relative z-10 max-w-2xl px-4 md:px-6"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Small label */}
        {/* <p className="text-[10px] tracking-[0.3em] uppercase text-fg-dim font-mono animate-fade-in delay-1 mb-12">
          About
        </p> */}

        {/* Bio — editorial, clean */}
        <div
          className="text-xs md:text-sm font-light text-gray-300 leading-relaxed tracking-tight text-fg animate-fade-in delay-6"
          style={{
            textShadow: "0 0 8px rgba(107, 114, 128, 0.45)",
            lineHeight: "1.3",
            whiteSpace: "pre-line",
          }}
        >
          {siteMetadata.bio}
        </div>

        {/* Details */}
        {/* <div className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-6 animate-fade-up delay-3">
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-fg-dim font-mono mb-1">
              Based in
            </p>
            <p className="text-sm text-fg-muted">{siteMetadata.location}</p>
          </div>
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-fg-dim font-mono mb-1">
              Genres
            </p>
            <p className="text-sm text-fg-muted">Wave · Experimental Bass</p>
          </div>
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-fg-dim font-mono mb-1">
              Labels
            </p>
            <p className="text-sm text-fg-muted">
              Wavemob · Terrorhythm · Liquid Ritual
            </p>
          </div>
        </div> */}

        {/* Social links */}
        <div className="mt-10 md:mt-14 flex flex-wrap justify-center gap-4 md:gap-6 animate-fade-in delay-4">
          {siteMetadata.socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.2em] uppercase text-fg-bright text-gray-300 hover:text-fg transition-colors duration-300 link-underline text-shadow-accent-hover
              "
              style={{
                textShadow: "0 0 8px rgba(107, 114, 128, 0.45)",
              }}
            >
              {link.platform}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
