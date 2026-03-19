"use client";

type Level = "high" | "moderate" | "low";

export interface RunPotentialIndicatorProps {
  level: Level;
  label: string;
}

export function RunPotentialIndicator({ level, label }: RunPotentialIndicatorProps) {
  const color =
    level === "high"
      ? "text-[var(--neo-success)]"
      : level === "low"
        ? "text-[var(--neo-warning)]"
        : "text-[var(--neo-text)]";

  return (
    <div>
      <div className="section-label">Run potential</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {level === "high" && <span aria-hidden>🔥</span>}
        {level === "moderate" && <span aria-hidden>🔥</span>}
        {level === "low" && <span aria-hidden>•</span>}
        <span className={color}>{label}</span>
      </div>
    </div>
  );
}
