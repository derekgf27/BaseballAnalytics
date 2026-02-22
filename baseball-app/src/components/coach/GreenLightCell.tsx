"use client";

import type { GreenLightVerdict } from "@/lib/types";

const VERDICT_STYLE: Record<GreenLightVerdict, { bg: string; label: string }> = {
  yes: { bg: "bg-emerald-500", label: "Yes" },
  no: { bg: "bg-red-500", label: "No" },
  situational: { bg: "bg-amber-400", label: "Situational" },
};

interface GreenLightCellProps {
  verdict: GreenLightVerdict;
}

export function GreenLightCell({ verdict }: GreenLightCellProps) {
  const { bg, label } = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${bg}`}
    >
      {label}
    </span>
  );
}
