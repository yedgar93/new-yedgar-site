"use client";

import LazyMount from "@/components/LazyMount";
import { siteMetadata } from "@/data/metadata";

export default function PressPage() {
  return (
    <main className="view-full animate-fade-in light-page">
      <LazyMount
        placeholder={<div className="canvas-placeholder fluid-placeholder" />}
      >
        <div /> {/* Placeholder child to satisfy Props interface */}
      </LazyMount>

      <div className="max-w-2xl px-4 md:px-6 text-center">
        {/* Small label */}
        <p className="text-[10px] tracking-[0.3em] uppercase text-fg-dim font-mono animate-fade-in delay-1 mb-8 md:mb-12">
          Press
        </p>

        {/* Press Links */}
        <ul className="text-sm md:text-md font-light leading-relaxed tracking-tight text-fg animate-fade-up delay-2 space-y-4 md:space-y-5 flex flex-col items-center">
          <li className="text-center">
            <a
              href="https://fuxwithit.com/2022/06/15/yedgar-dont-look-back/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:underline"
            >
              FUXWITHIT.COM - Listen To wavemob's New Release 'Don't Look Back'
              By Yedgar
            </a>
          </li>
          <li className="text-center">
            <a
              href="https://polymerzine.club/2021/04/03/grime-dubstep-monthly-12/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:underline"
            >
              POLYMERZINE.CLUB (MixMag) - GRIME & DUBSTEP MONTHLY™ — YEDGAR LIFE
              CYCLE EP REVIEW
            </a>
          </li>
          <li className="text-center">
            <a
              href="https://daily.bandcamp.com/best-electronic/the-best-electronic-music-on-bandcamp-march-2021?fbclid=IwAR39OV6hSZk4drVcmmjDH-ClOnCorVjBHVlzQcpF8x-f5-wRq-Id7iMt8cU"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:underline"
            >
              BANDCAMP - The Best Electronic Music on Bandcamp: March 2021
            </a>
          </li>
          <li className="text-center">
            <a
              href="https://ukf.com/read/why-wavepool-2-is-a-critical-moment-for-wave-music/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:underline"
            >
              UKF - WHY WAVEPOOL 2 IS A CRITICAL MOMENT FOR WAVE MUSIC
            </a>
          </li>
          <li className="text-center">
            <a
              href="https://www.highsnobiety.com/2016/08/11/soundcloud-wave-music/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:underline"
            >
              HIGHSNOBIETY - WAVE MUSIC: WHY YOU NEED THIS GENRE IN YOUR LIFE
              RIGHT NOW
            </a>
          </li>
        </ul>

        {/* Social links */}
      </div>
    </main>
  );
}
