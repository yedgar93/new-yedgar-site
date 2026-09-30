import React, { useEffect, useState } from "react";

const CustomSoundCloudPlayer = ({
  trackUrl,
  shouldAutoPlay,
}: {
  trackUrl: string;
  shouldAutoPlay: boolean;
}) => {
  const [opacity, setOpacity] = useState(0);
  const [seenUrl, setSeenUrl] = useState(trackUrl);

  if (trackUrl !== seenUrl) {
    setSeenUrl(trackUrl);
    setOpacity(0);
  }

  useEffect(() => {
    if (!trackUrl || opacity === 1) return;
    const fadeIn = window.setTimeout(() => setOpacity(1), 300);
    return () => window.clearTimeout(fadeIn);
  }, [opacity, trackUrl]);

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    trackUrl,
  )}&color=%23000000&inverse=true&auto_play=${shouldAutoPlay}&show_user=false&visual=false`;

  return (
    <>
      <link rel="dns-prefetch" href="https://w.soundcloud.com" />
      <link rel="preconnect" href="https://w.soundcloud.com" />
      <link rel="preconnect" href="https://api.soundcloud.com" />

      <div style={{ opacity: 0.75 }}>
        <iframe
          title="SoundCloud Player"
          width="100%"
          height="20"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
            opacity,
            transition: "opacity 0.5s ease-in-out",
            backgroundColor: "transparent",
          }}
        ></iframe>
      </div>
    </>
  );
};

export default CustomSoundCloudPlayer;
