"use client";

import dynamic from "next/dynamic";
import type { CoachLineupClientProps } from "./CoachLineupClient";

/**
 * next/dynamic with ssr:false must live in a Client Component (Next 16+).
 * Avoids @dnd-kit hydration mismatches on aria-describedby.
 */
const CoachLineupClientLazy = dynamic(
  () => import("./CoachLineupClient").then((m) => ({ default: m.CoachLineupClient })),
  {
    ssr: false,
    loading: () => (
      <div className="app-shell flex min-h-[40vh] items-center justify-center p-8">
        <p className="text-sm text-[var(--neo-text-muted)]">Loading lineup editor…</p>
      </div>
    ),
  }
);

export function CoachLineupClientGate(props: CoachLineupClientProps) {
  return <CoachLineupClientLazy {...props} />;
}
