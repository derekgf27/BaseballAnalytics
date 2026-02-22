"use client";

import type { Confidence } from "@/data/mock";

/**
 * Visual confidence indicator: green / yellow / red / gray.
 * Decisions > data — no numbers, just a quick read.
 */
const CONFIDENCE_STYLES: Record<
  Confidence,
  { bg: string; label: string; dot?: string }
> = {
  high: {
    bg: "bg-[var(--decision-green)]",
    label: "High confidence",
    dot: "bg-[var(--decision-green)]",
  },
  medium: {
    bg: "bg-[var(--decision-yellow)]",
    label: "Monitor",
    dot: "bg-[var(--decision-yellow)]",
  },
  low: {
    bg: "bg-[var(--decision-red)]",
    label: "Risk",
    dot: "bg-[var(--decision-red)]",
  },
  none: {
    bg: "bg-[var(--decision-gray)]",
    label: "No data",
    dot: "bg-[var(--decision-gray)]",
  },
};

export function ConfidenceBar({
  confidence,
  showLabel = false,
  size = "md",
}: {
  confidence: Confidence;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const style = CONFIDENCE_STYLES[confidence];
  const isSm = size === "sm";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`rounded-full ${style.dot ?? style.bg} ${isSm ? "h-2 w-2" : "h-3 w-3"}`}
        title={style.label}
        aria-label={style.label}
      />
      {showLabel && (
        <span className="text-xs text-[var(--text-muted)]">{style.label}</span>
      )}
    </div>
  );
}

/**
 * Bar-style confidence (segment of a bar). Use for situational value.
 */
export function ConfidenceSegment({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  const style = CONFIDENCE_STYLES[confidence];
  return (
    <div
      className={`h-2 flex-1 rounded ${style.bg} ${className ?? ""}`}
      title={CONFIDENCE_STYLES[confidence].label}
    />
  );
}
