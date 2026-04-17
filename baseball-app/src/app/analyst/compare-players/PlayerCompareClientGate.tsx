"use client";

import dynamic from "next/dynamic";
import type { PlayerCompareClientProps } from "./PlayerCompareClient";

/**
 * next/dynamic with ssr:false must live in a Client Component.
 * Avoids @dnd-kit hydration mismatches on aria-describedby.
 */
const PlayerCompareClientLazy = dynamic<PlayerCompareClientProps>(
  () => import("./PlayerCompareClient").then((m) => ({ default: m.PlayerCompareClient })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-4" aria-hidden>
        <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--bg-card)]" />
        <div className="h-[min(50vh,24rem)] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-card)]" />
      </div>
    ),
  }
);

export function PlayerCompareClientGate(props: PlayerCompareClientProps) {
  return <PlayerCompareClientLazy {...props} />;
}
