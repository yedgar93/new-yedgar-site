"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { throttle } from "lodash-es"; // Import throttle from lodash-es

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
  const [transitionDuration, setTransitionDuration] = useState("2s");

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
    const handleDayNightCycle = (event: CustomEvent<{ isNight: boolean; sunNorm: number }>) => {
      const { isNight, sunNorm } = event.detail; // Use isNight for logo color

      // Set logo color based on isNight
      const targetColor = isNight ? "white" : "black";
      console.log(
        "Received isNight:",
        isNight,
        "Setting logo color to:",
        targetColor,
      ); // Debugging log
      setLogoColor(targetColor);
    };

    window.addEventListener(
      "dayNightCycle",
      handleDayNightCycle as EventListener
    );

    return () => {
      window.removeEventListener(
        "dayNightCycle",
        handleDayNightCycle as EventListener
      );
    };
  }, []);

  const shouldUseWhiteLogo =
    // isHomePage ||
    pathname === "/about," || isNight;
  // || pathname === "music";
  // Adjusted to include night logic

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
        className="fixed top-0 left-0 z-50 w-full flex justify-center py-4 md:py-6 pointer-events-none"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <Link href="/" className="pointer-events-auto">
          <img
            src={shouldUseWhiteLogo ? "/logo-wht.png" : "/logo-blk.png"}
            alt="Yedgar Logo"
            className={`h-14 md:h-22 mt-1 md:mt-2 object-contain animate-fade-in ${
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
