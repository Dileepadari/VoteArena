/**
 * An element's measured size, kept current with a ResizeObserver.
 *
 * The bubble field and the leaderboard both lay out from real pixels rather
 * than breakpoints, because a projected wall is a size no breakpoint expects.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export interface Size {
  width: number;
  height: number;
}

/** Tracks an element's box, so canvases and simulations can size themselves. */
export function useElementSize<T extends HTMLElement>(): [RefObject<T>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize((prev) =>
        // Sub-pixel jitter would restart the force simulation on every frame.
        Math.abs(prev.width - box.width) < 1 && Math.abs(prev.height - box.height) < 1
          ? prev
          : { width: box.width, height: box.height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
