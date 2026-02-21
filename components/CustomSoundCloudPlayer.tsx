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

  useEffect(() => {
    if (iframeRef.current) {
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== "https://w.soundcloud.com") return;
        const data = JSON.parse(event.data);
        if (data.event === "ready" && shouldAutoPlay) {
          const message = JSON.stringify({ method: "play" });
          iframeRef.current?.contentWindow?.postMessage(
            message,
            "https://w.soundcloud.com",
          );
        }
      };

      window.addEventListener("message", handleMessage);

      // Send a message to the iframe to initialize the player
      const initMessage = JSON.stringify({
        method: "addEventListener",
        events: ["ready"],
      });
      iframeRef.current.contentWindow?.postMessage(
        initMessage,
        "https://w.soundcloud.com",
      );

      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [trackUrl, shouldAutoPlay]);

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
        <iframe
          ref={iframeRef}
          width="350px"
          height="20"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          onLoad={() => setIsLoaded(true)} // Set loaded state
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
            opacity: isLoaded ? 0.675 : 0, // Hide until loaded
            transition: "opacity 0.5s ease", // Smooth fade-in
          }}
        ></iframe>
      </div>
    </>
  );
};

export default CustomSoundCloudPlayer;
