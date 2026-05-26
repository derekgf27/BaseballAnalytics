"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Player } from "@/lib/types";

function normalizeHand(hand: string | null | undefined): string | null {
  if (hand == null || hand === "") return null;
  const code = hand.toUpperCase();
  if (code.startsWith("L")) return "Left";
  if (code.startsWith("R")) return "Right";
  if (code.startsWith("S")) return "Switch";
  return hand;
}

export type PlayerProfileHeroProps = {
  player: Player;
  /** Shown under handedness (e.g. analyst compare link). */
  compareHref?: string;
  /** Badge or chip beside the name (e.g. coach trend). */
  titleExtra?: ReactNode;
  /** Smaller facts below the hero line (positions, height, etc.). */
  secondaryFacts?: { label: string; value: string }[];
  children?: ReactNode;
};

export function PlayerProfileHero({
  player,
  compareHref,
  titleExtra,
  secondaryFacts,
  children,
}: PlayerProfileHeroProps) {
  const jersey =
    player.jersey != null && String(player.jersey).trim() !== "" ? `#${player.jersey}` : null;
  const batsLabel = normalizeHand(player.bats);
  const throwsLabel = normalizeHand(player.throws);
  const handParts: string[] = [];
  if (batsLabel) handParts.push(`Bats ${batsLabel}`);
  if (throwsLabel) handParts.push(`Throws ${throwsLabel}`);
  const handLine = handParts.length > 0 ? handParts.join(" · ") : null;

  return (
    <header className="space-y-4">
      <div className="space-y-2">
        {jersey ? (
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-[var(--accent)] sm:text-4xl">
            {jersey}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            {player.name}
          </h1>
          {titleExtra}
        </div>
        {handLine ? <p className="text-lg font-medium text-[var(--text)] sm:text-xl">{handLine}</p> : null}
        {compareHref ? (
          <Link
            href={compareHref}
            className="inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Compare with…
          </Link>
        ) : null}
      </div>

      {secondaryFacts && secondaryFacts.length > 0 ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
          {secondaryFacts.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
              <dd className="mt-0.5 font-medium text-[var(--text)]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children}
    </header>
  );
}
