"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { throttle } from "lodash-es"; // Import throttle from lodash-es
import { DAY_NIGHT_PERIOD } from "./GrassBackground"; // Import the day-night period constant

const links = [
  { href: "/", label: "Home" },
  { href: "/music", label: "Music" },
  { href: "/about", label: "About" },
  { href: "/press", label: "Press" }, // Added Press page link
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [isNight, setIsNight] = useState(false);
  const [logoColor, setLogoColor] = useState("black"); // Default to black
  const [transitionDuration, setTransitionDuration] = useState("4s");

  useEffect(() => {
    const throttledScroll = throttle(() => {
      // Scroll logic here
    }, 100);

    window.addEventListener("scroll", throttledScroll);

    // Set isInitialLoad to false after the first render
    const timer = setTimeout(() => setIsInitialLoad(false), 0);

    return () => {
      window.removeEventListener("scroll", throttledScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = (performance.now() / 1000) % DAY_NIGHT_PERIOD; // Simulated time in seconds
      const sunY = Math.sin((t / DAY_NIGHT_PERIOD) * Math.PI * 2) * 50 + 5; // Simulated sun position

      // Calculate normalized sun position (0 at night, 1 at noon)
      const sunNorm = Math.max(0, Math.min(1, (sunY + 10) / 65));

      // Determine if it is nighttime
      setIsNight(sunNorm < 0.18); // Nighttime threshold
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const shouldUseWhiteLogo = isHomePage || pathname === "/about";
  // || pathname === "/music"; // Always use white logo on the music page

  // Fade logo when pathname changes
  useEffect(() => {
    setLogoOpacity(0);
    const timer = setTimeout(() => {
      setLogoOpacity(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [shouldUseWhiteLogo]);

  return (
    <>
      {/* Top logo */}
      <header
        className="fixed top-0 left-0 z-50 w-full flex justify-center py-4 md:py-5 pointer-events-none"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <Link href="/" className="pointer-events-auto">
          <img
            src={shouldUseWhiteLogo ? "/logo-wht.png" : "/logo-blk.png"}
            alt="Yedgar Logo"
            className={`h-17 md:h-25 mt-1 md:mt-2 object-contain animate-fade-in ${
              isInitialLoad ? "opacity-0" : "opacity-100"
            }`}
            style={{
              opacity: logoOpacity,
              transition: `color ${transitionDuration} ease`, // Smooth transition
              color: logoColor, // Dynamically set color
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
