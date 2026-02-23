import React, { useEffect, useRef, useState } from "react";

const CustomSoundCloudPlayer = ({
  trackUrl,
  shouldAutoPlay,
}: {
  trackUrl: string;
  shouldAutoPlay: boolean;
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false); // Track iframe loading state
  const [hasError, setHasError] = useState(false); // Track error state
  const [retryCount, setRetryCount] = useState(0); // Track retry count

  useEffect(() => {
    if (!trackUrl) {
      console.error("Invalid track URL provided:", trackUrl);
      setHasError(true);
      return;
    }

    setIsLoaded(false); // Reset loading state when trackUrl changes
    setHasError(false); // Reset error state when trackUrl changes
    setRetryCount(0); // Reset retry count when trackUrl changes

    if (isLoaded || retryCount >= 3) {
      // Prevent retry logic if the player is already loaded or retry limit is reached
      return;
    }
  }, [isLoaded, retryCount, trackUrl]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    trackUrl,
  )}&color=%23000000&inverse=true&auto_play=${shouldAutoPlay}&show_user=false&visual=false`;

  return (
    <>
      {/* Preload DNS and preconnect for faster iframe loading */}
      <link rel="dns-prefetch" href="https://w.soundcloud.com" />
      <link rel="preconnect" href="https://w.soundcloud.com" />
      <link rel="preconnect" href="https://api.soundcloud.com" />

      {
        <iframe
          ref={iframeRef}
          title="SoundCloud Player"
          width="100%"
          height="20"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          onLoad={handleLoad}
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
          }}
        ></iframe>
      }
    </>
  );
};

export default CustomSoundCloudPlayer;
