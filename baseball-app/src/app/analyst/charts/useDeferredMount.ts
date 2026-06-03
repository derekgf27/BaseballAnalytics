"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Mount children when the sentinel enters the viewport (lazy section load). */
export function useDeferredMount(rootMargin = "200px"): { sentinelRef: RefObject<HTMLDivElement | null>; ready: boolean } {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  return { sentinelRef, ready };
}
