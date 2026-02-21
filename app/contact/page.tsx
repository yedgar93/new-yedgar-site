"use client";

import { siteMetadata } from "@/data/metadata";
import { useState } from "react";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(siteMetadata.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="view-full light-page">
      <div className="max-w-lg px-6 text-center">
        {/* Small label */}
        <p className="text-[10px] tracking-[0.3em] uppercase text-fg-dim font-mono animate-fade-in delay-1 mb-8">
          Contact
        </p>

        {/* Big statement */}
        <h1 className="text-3xl md:text-4xl font-light leading-snug tracking-tight text-fg animate-fade-up delay-2">
          For bookings, press,
          <br />
          and inquiries.
        </h1>

        {/* Email button */}
        <button
          onClick={copyEmail}
          className="mt-12 group animate-fade-up delay-3"
        >
          <span className="text-lg md:text-xl font-medium text-fg tracking-tight group-hover:opacity-70 transition-opacity duration-300">
            {siteMetadata.email}
          </span>
          <span className="block mt-2 text-[10px] tracking-[0.2em] uppercase text-fg-dim transition-colors duration-300">
            {copied ? "Copied ✓" : "Click to copy"}
          </span>
        </button>

        {/* Social links */}
        <div className="mt-16 flex flex-wrap justify-center gap-6 animate-fade-in delay-4">
          {siteMetadata.socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.2em] uppercase text-fg-dim hover:text-fg transition-colors duration-300 link-underline"
            >
              {link.platform}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
