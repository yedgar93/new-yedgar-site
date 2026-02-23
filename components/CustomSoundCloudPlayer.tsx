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
  const [isVisible, setIsVisible] = useState(false); // Track visibility state
  const [isFadingOut, setIsFadingOut] = useState(false); // Track fade-out state

  useEffect(() => {
    if (!trackUrl) {
      console.error("Invalid track URL provided:", trackUrl);
      setHasError(true);
      return;
    }

    // Trigger fade-out effect
    setIsFadingOut(true);

    const fadeOutTimeout = setTimeout(() => {
      // Ensure the iframe remains visible during fade-out
      setIsVisible(false); // Hide iframe only after fade-out completes

      // Reset states and prepare for new track
      setIsLoaded(false);
      setHasError(false);
      setRetryCount(0);

      // Load the new track only after fade-out is complete
      const loadTrackTimeout = setTimeout(() => {
        setIsFadingOut(false);
        setIsVisible(true); // Trigger fade-in effect
      }, 250); // Duration of fade-in effect

      return () => clearTimeout(loadTrackTimeout);
    }, 300); // Duration of fade-out effect

    return () => {
      clearTimeout(fadeOutTimeout);
    };
  }, [trackUrl]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);

    // Ensure visibility is set after loading
    if (!isVisible) {
      setIsVisible(true);
    }
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
          opacity: isFadingOut ? 0 : isVisible ? 1 : 0, // Dynamically adjust opacity for fade-in and fade-out
          transition: "opacity 0.5s ease-in-out", // Smooth transition for both fade-out and fade-in
          backgroundColor: "transparent", // Set background to transparent
        }}
      ></iframe>
    </>
  );
};

export default CustomSoundCloudPlayer;
