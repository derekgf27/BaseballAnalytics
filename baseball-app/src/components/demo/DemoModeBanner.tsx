"use client";

import Link from "next/link";
import { isDemoMode } from "@/lib/demoMode";

export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
    >
      <span className="font-medium">Portfolio demo</span>
      <span className="mx-2 text-amber-200/70">·</span>
      Sample data · read-only
      <span className="mx-2 text-amber-200/70">·</span>
      <Link href="/" className="font-medium text-amber-200 underline-offset-2 hover:underline">
        Tour guide
      </Link>
    </div>
  );
}
