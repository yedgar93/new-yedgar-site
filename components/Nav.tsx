"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/music", label: "Music" },
  { href: "/about", label: "About" },
  { href: "/press", label: "Press" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const mode = pathname === "/" || pathname === "/about" ? "white" : pathname === "/music" ? "world" : "black";

  return (
    <>
      <header
        className="fixed top-0 left-0 z-50 w-full flex justify-center py-4 md:py-5 pointer-events-none"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1rem)",
          zIndex: 1000,
        }}
      >
        <Link href="/" className="pointer-events-auto">
          <span className={`logo-stack logo-mode-${mode}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-blk.png" alt="" className="logo-img logo-blk" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wht.png" alt="Yedgar" className="logo-img logo-wht" />
          </span>
        </Link>
      </header>

      <nav
        className="site-nav fixed bottom-0 left-0 z-50 w-full flex justify-center pb-5 md:pb-8 pointer-events-none"
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
