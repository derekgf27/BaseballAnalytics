"use client";

import type { PlayerTagType } from "@/data/mock";

/**
 * Simple tags for quick read: POWER, CONTACT, SPEED, etc.
 * Human language over jargon — no decimals.
 */
const TAG_STYLES: Record<PlayerTagType, string> = {
  POWER: "bg-[var(--decision-red-dim)] text-[var(--decision-red)] border border-[var(--decision-red)]/30",
  CONTACT: "bg-[var(--decision-green-dim)] text-[var(--decision-green)] border border-[var(--decision-green)]/30",
  SPEED: "bg-[var(--accent-coach-dim)] text-[var(--accent-coach)] border border-[var(--accent-coach)]/30",
  EYE: "bg-[var(--decision-yellow-dim)] text-[var(--decision-yellow)] border border-[var(--decision-yellow)]/30",
  CLUTCH: "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30",
};

export function PlayerTag({ tag }: { tag: PlayerTagType }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG_STYLES[tag]}`}
    >
      {tag}
    </span>
  );
}

export function PlayerTagList({ tags }: { tags: PlayerTagType[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <PlayerTag key={t} tag={t} />
      ))}
    </div>
  );
}
