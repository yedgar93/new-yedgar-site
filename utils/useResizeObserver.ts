import { useEffect } from "react";

/**
 * useResizeObserver
 * Calls the callback whenever the element's size changes.
 * Returns nothing, just pass the ref and callback.
 */
export function useResizeObserver(ref: React.RefObject<Element>, callback: () => void) {
  useEffect(() => {
    if (!ref.current) return;
    const observer = new window.ResizeObserver(() => {
      callback();
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, [ref, callback]);
}
