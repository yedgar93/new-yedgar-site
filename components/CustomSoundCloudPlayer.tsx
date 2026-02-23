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

    const timer = setTimeout(() => {
      if (!isLoaded && retryCount < 3) {
        console.warn("Retrying SoundCloud player load for URL:", trackUrl);
        setRetryCount((prev) => prev + 1);
      } else if (!isLoaded) {
        console.error(
          "Failed to load SoundCloud player after retries for URL:",
          trackUrl
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
  )}&color=%23000000&inverse=true&auto_play=false&show_user=false&visual=false`;

  return (
    <>
      {/* Preload DNS and preconnect for faster iframe loading */}
      <link rel="dns-prefetch" href="https://w.soundcloud.com" />
      <link
        rel="preconnect"
        href="https://w.soundcloud.com"
        crossOrigin="anonymous"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        {!isLoaded && <div className="loading">Loading SoundCloud player...</div>}
        <iframe
          ref={iframeRef}
          width="100%"
          height="20"
          scrolling="yes"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          onLoad={handleLoad}
          onError={() => setHasError(true)}
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
            opacity: isLoaded ? 1 : 0, // Ensure it fades in only when loaded
            transition: "opacity 0.5s ease", // Smooth fade-in
          }}
        ></iframe>
      </div>

      {hasError && (
        <div className="error">
          Failed to load SoundCloud player. Please refresh the page or try again later.
        </div>
      )}
    </>
  );
};

export default CustomSoundCloudPlayer;
