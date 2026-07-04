"use client";

import Link from "next/link";
import { isDemoMode } from "@/lib/demoMode";

export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="status"
      className="demo-mode-banner shrink-0 border-b border-amber-600/35 bg-amber-100/90 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <span className="font-medium">Portfolio demo</span>
      <span className="mx-2 text-amber-800/65 dark:text-amber-200/70">·</span>
      Sample data · read-only
      <span className="mx-2 text-amber-800/65 dark:text-amber-200/70">·</span>
      <Link
        href="/"
        className="font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
      >
        Tour guide
      </Link>
    </div>
  );
}
