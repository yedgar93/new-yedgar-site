"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { throttle } from "lodash-es";
import { DAY_NIGHT_PERIOD, TWO_PI_OVER_DAY_NIGHT } from "./GrassBackground";
import { useContext } from "react";
import { SunContext } from "./SunContext";
import { defaultStarSettings } from "./Stars";

const links = [
  { href: "/", label: "Home" },
  { href: "/music", label: "Music" },
  { href: "/about", label: "About" },
  { href: "/press", label: "Press" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [isNight, setIsNight] = useState(false);
  const [logoColor, setLogoColor] = useState("black");
  const [transitionDuration, setTransitionDuration] = useState("4s");
  const { sunNorm } = useContext(SunContext);

  useEffect(() => {
    const throttledScroll = throttle(() => {
      // Scroll logic here
    }, 100);

    window.addEventListener("scroll", throttledScroll);
    const timer = setTimeout(() => setIsInitialLoad(false), 0);

    return () => {
      window.removeEventListener("scroll", throttledScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setIsNight(sunNorm < 0.18);
  }, [sunNorm]);

  // White logo when: on a page that always uses white, OR it's night
  const pathAlwaysWhite = isHomePage || pathname === "/about";
  const shouldUseWhiteLogo = pathAlwaysWhite || isNight;

  // Fade logo out/in whenever the logo image needs to swap
  // keep initial load fade behavior
  useEffect(() => {
    setLogoOpacity(0);
    const timer = setTimeout(() => setLogoOpacity(1), 300);
    return () => clearTimeout(timer);
  }, [shouldUseWhiteLogo]);

  // Compute smooth crossfade factor matching grass/star fade thresholds
  const fadeLow = defaultStarSettings.fadeLow; // ~0.19
  const fadeHigh = defaultStarSettings.fadeHigh; // ~0.4
  const smoothstep = (x: number, a: number, b: number) => {
    if (x <= a) return 0;
    if (x >= b) return 1;
    return (x - a) / (b - a);
  };
  // t = 0 at night, 1 at day — we want whiteOpacity = 1 - t
  const t = smoothstep(sunNorm, fadeLow, fadeHigh);
  const whiteOpacity = 1 - t;
  const blackOpacity = t;

  return (
    <>
      {/* Top logo */}
      <header
        className="fixed top-0 left-0 z-50 w-full flex justify-center py-4 md:py-5 pointer-events-none"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1rem)",
          zIndex: 1000,
        }}
      >
        <Link href="/" className="pointer-events-auto">
          <img
            src={shouldUseWhiteLogo ? "/logo-wht.png" : "/logo-blk.png"}
            alt="Yedgar"
            className={`h-18 md:h-18 sm:h-20 mt-1 md:mt-2 object-contain animate-fade-in ${
              isInitialLoad ? "opacity-0" : "opacity-100"
            }`}
            style={{
              opacity: logoOpacity * (shouldUseWhiteLogo ? whiteOpacity : blackOpacity),
              transition: `opacity ${transitionDuration} ease`,
              color: logoColor,
            }}
          />
        </Link>
      </header>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 z-50 w-full flex justify-center pb-5 md:pb-8 pointer-events-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        <div className="flex items-center gap-4 md:gap-8 pointer-events-auto animate-fade-in delay-4">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-[11px] tracking-[0.2em] uppercase transition-colors duration-300 ${
                  isActive ? "text-fg" : "text-fg-dim hover:text-fg-muted"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-fg" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
