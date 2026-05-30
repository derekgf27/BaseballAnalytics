"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type ClientGateOptions = {
  loadingMessage?: string;
  minHeightClass?: string;
};

/**
 * Lazy-load a large client page bundle (ssr:false) with a consistent loading shell.
 */
export function createClientGate<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: ClientGateOptions
): ComponentType<P> {
  const loadingMessage = options?.loadingMessage ?? "Loading…";
  const minH = options?.minHeightClass ?? "min-h-[40vh]";

  const Lazy = dynamic(importFn, {
    ssr: false,
    loading: () => (
      <div
        className={`app-shell flex ${minH} items-center justify-center p-8`}
        aria-busy="true"
        aria-label={loadingMessage}
      >
        <p className="text-sm text-[var(--text-muted)]">{loadingMessage}</p>
      </div>
    ),
  });

  function ClientGate(props: P) {
    return <Lazy {...props} />;
  }

  return ClientGate;
}
