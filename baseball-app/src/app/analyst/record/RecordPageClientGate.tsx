"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type RecordPageClient from "./RecordPageClient";

type RecordPageClientProps = ComponentProps<typeof RecordPageClient>;

const RecordPageClientLazy = dynamic(() => import("./RecordPageClient"), {
  loading: () => (
    <div className="space-y-4" aria-busy="true" aria-label="Loading record page">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      <div className="h-[min(60vh,32rem)] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-card)]" />
    </div>
  ),
});

export function RecordPageClientGate(props: RecordPageClientProps) {
  return <RecordPageClientLazy {...props} />;
}
