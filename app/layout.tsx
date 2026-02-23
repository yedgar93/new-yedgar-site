import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import LayoutClient from "./LayoutClient";
import Head from 'next/head';

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Yedgar",
  description:
    "Electronic music producer and DJ from Edmonton, Canada. Wave, experimental bass, melodic bass. Releases on Wavemob, Terrorhythm Recordings, Liquid Ritual.",
  keywords: [
    "Yedgar",
    "wave music",
    "experimental bass",
    "Edmonton",
    "electronic music",
    "Wavemob",
    "Terrorhythm",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Head>
        {/* Preload DNS and preconnect for external resources */}
        <link rel="dns-prefetch" href="https://w.soundcloud.com" />
        <link rel="preconnect" href="https://w.soundcloud.com" />
        <link rel="preconnect" href="https://api.soundcloud.com" />
        {/* Add other external resources here if needed */}
      </Head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
