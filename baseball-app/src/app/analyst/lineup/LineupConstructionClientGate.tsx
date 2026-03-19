"use client";

import dynamic from "next/dynamic";
import type { LineupConstructionClientProps } from "./LineupConstructionClient";

const LineupConstructionClientLazy = dynamic(() => import("./LineupConstructionClient"), {
  ssr: false,
  loading: () => (
    <div className="app-shell flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-sm text-[var(--neo-text-muted)]">Loading lineup builder…</p>
    </div>
  ),
});

export function LineupConstructionClientGate(props: LineupConstructionClientProps) {
  return <LineupConstructionClientLazy {...props} />;
}
