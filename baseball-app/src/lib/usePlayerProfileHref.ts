"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { coachPlayerProfileHref } from "@/lib/coachRoutes";

/** Profile links follow the portal in the URL (/coach vs /analyst). */
export function usePlayerProfileHref(): (playerId: string) => string {
  const pathname = usePathname();
  return useMemo(
    () => (pathname?.startsWith("/coach") ? coachPlayerProfileHref : analystPlayerProfileHref),
    [pathname]
  );
}
