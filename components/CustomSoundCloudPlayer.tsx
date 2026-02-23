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
    setIsLoaded(false); // Reset loading state whenever trackUrl changes
    if (iframeRef.current) {
      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from the player iframe instance
        if (!iframeRef.current) return;
        try {
          if (event.source !== iframeRef.current.contentWindow) return;
        } catch (e) {
          return;
        }

        // Some messages are plain strings or not JSON — guard parse
        let data: any = null;
        try {
          data =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
        } catch (err) {
          return;
        }

        if (data && data.event === "ready" && shouldAutoPlay) {
          const message = JSON.stringify({ method: "play" });
          try {
            iframeRef.current?.contentWindow?.postMessage(message, "*");
          } catch (e) {}
        }
      };

      window.addEventListener("message", handleMessage);

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
          width="100%"
          height="20"
          scrolling="yes"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          onLoad={() => {
            setIsLoaded(true);
            const sendInit = (attempt = 0) => {
              try {
                const initMessage = JSON.stringify({
                  method: "addEventListener",
                  events: ["ready"],
                });
                iframeRef.current?.contentWindow?.postMessage(initMessage, "*");
              } catch (e) {}
              if (attempt < 3) {
                setTimeout(() => sendInit(attempt + 1), 500);
              }
            };
            setTimeout(() => sendInit(), 300);
          }}
          style={{
            maxWidth: "600px",
            filter: "grayscale(100%)",
            opacity: isLoaded ? 1 : 0, // Ensure it fades in only when loaded
            transition: "opacity 0.5s ease", // Smooth fade-in
          }}
        ></iframe>
      </div>
    </>
  );
};

export default CustomSoundCloudPlayer;
