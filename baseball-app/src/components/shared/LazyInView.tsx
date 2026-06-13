"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Renders children once the placeholder enters (or nears) the viewport. */
export function LazyInView({
  children,
  minHeight = 120,
  forceShow = false,
  className,
}: {
  children: ReactNode;
  minHeight?: number;
  forceShow?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceShow);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [forceShow, visible]);

  if (visible || forceShow) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight }}
      aria-hidden
    />
  );
}
