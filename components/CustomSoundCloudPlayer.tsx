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

    const timer = setTimeout(() => {
      if (!isLoaded && retryCount < 3) {
        console.warn("Retrying SoundCloud player load for URL:", trackUrl);
        setRetryCount((prev) => prev + 1);
      } else if (!isLoaded) {
        console.error(
          "Failed to load SoundCloud player after retries for URL:",
          trackUrl,
        );
        setHasError(true);
      }
    }, 5000); // Retry every 5 seconds, up to 3 times

    return () => clearTimeout(timer);
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

      {hasError ? (
        <div>Error loading SoundCloud player. Please try again later.</div>
      ) : (
        <iframe
          ref={iframeRef}
          title="SoundCloud Player"
          width="100%"
          height="20"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
            opacity: isLoaded ? 1 : 0, // Ensure it fades in only when loaded
            transition: "opacity 0.5s ease", // Smooth fade-in
          }}
          src={embedUrl}
          onLoad={handleLoad}
        ></iframe>
      )}
    </>
  );
};

export default CustomSoundCloudPlayer;
