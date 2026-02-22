"use client";

import type { SituationTone } from "@/lib/types";

interface SituationResultProps {
  tone: SituationTone;
  sentence: string;
}

const TONE_STYLE: Record<SituationTone, { color: string }> = {
  aggressive: { color: "var(--warning)" },
  neutral: { color: "var(--text-muted)" },
  conservative: { color: "var(--accent-coach)" },
};

export function SituationResult({ tone, sentence }: SituationResultProps) {
  const { color } = TONE_STYLE[tone];
  return (
    <div className="card-tech p-5">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {tone}
      </p>
      <p className="mt-2 text-[var(--text)] leading-relaxed">{sentence}</p>
    </div>
  );
}
