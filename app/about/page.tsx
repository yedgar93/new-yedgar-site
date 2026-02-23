"use client";

import { useEffect, useState } from "react";
import { siteMetadata } from "@/data/metadata";

export default function AboutPage() {
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoList, setVideoList] = useState<string[]>([]);

  useEffect(() => {
    // Fetch video files from the 'public/videos' folder
    const fetchVideos = async () => {
      const response = await fetch("/videos/videos.json");
      const videos = await response.json();
      setVideoList(videos);
    };

    fetchVideos();
  }, []);

  useEffect(() => {
    if (videoList.length === 0) return;

    const interval = setInterval(() => {
      setVideoIndex((prevIndex) => (prevIndex + 1) % videoList.length);
    }, 10000); // Change video every 10 seconds

    return () => clearInterval(interval);
  }, [videoList]);

  return (
    <main className="view-full no-scroll about-page animate-fade-in delay-3">
      {/* Background video */}
      {videoList.length > 0 && (
        <video
          src={`/videos/${videoList[videoIndex]}`}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* 50% overlay so text stays readable */}
      <div className="absolute inset-0 bg-[#2f1d42]/44" />
      <div className="absolute inset-0 bg-[black]/65" />

      <div
        className="relative z-10 max-w-2xl px-4 md:px-6"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Bio — editorial, clean */}
        <div
          className="text-xs md:text-sm font-light text-gray-300 leading-relaxed tracking-tightanimate-fade-in delay-6"
          style={{
            textShadow: "0 0 8px rgba(107, 114, 128, 0.45)",
            lineHeight: "1.3",
            whiteSpace: "pre-line",
          }}
        >
          {siteMetadata.bio}
        </div>
      </div>
    </main>
  );
}
