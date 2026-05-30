"use client";

import type { ReactNode } from "react";
import { formatPositionsDisplay } from "@/lib/playerRoster";
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
  /** Badge or chip beside the name (e.g. coach trend). */
  titleExtra?: ReactNode;
  /** Smaller facts below the hero line (positions, height, etc.). */
  secondaryFacts?: { label: string; value: string }[];
  /** Inline with jersey number (e.g. export report). */
  jerseyTrailing?: ReactNode;
  children?: ReactNode;
};

export function PlayerProfileHero({
  player,
  titleExtra,
  secondaryFacts,
  jerseyTrailing,
  children,
}: PlayerProfileHeroProps) {
  const jersey =
    player.jersey != null && String(player.jersey).trim() !== "" ? `#${player.jersey}` : null;
  const batsLabel = normalizeHand(player.bats);
  const throwsLabel = normalizeHand(player.throws);
  const positionsLine =
    player.positions?.length > 0 ? formatPositionsDisplay(player) : null;
  const hasMetaAside = batsLabel != null || throwsLabel != null || positionsLine != null;

  const metaKicker =
    "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]";
  const metaValue = "font-display text-xl font-semibold leading-tight text-white sm:text-2xl";

  return (
    <header className="space-y-4">
      <div className="space-y-2">
        {jersey || jerseyTrailing ? (
          <div className="flex w-full flex-wrap items-center gap-3 sm:gap-4">
            {jersey ? (
              <p className="font-orbitron text-3xl font-semibold tabular-nums tracking-tight text-[var(--accent)] sm:text-4xl">
                {jersey}
              </p>
            ) : null}
            {jerseyTrailing ? (
              <div className="ml-auto flex shrink-0 items-center">{jerseyTrailing}</div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-orbitron text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
              {player.name}
            </h1>
            {titleExtra}
          </div>
          {hasMetaAside ? (
            <dl className="flex shrink-0 flex-wrap items-end justify-end gap-x-6 gap-y-2 sm:gap-x-8">
              {batsLabel ? (
                <div className="text-right">
                  <dt className={metaKicker}>Bats</dt>
                  <dd className={metaValue}>{batsLabel}</dd>
                </div>
              ) : null}
              {throwsLabel ? (
                <div className="text-right">
                  <dt className={metaKicker}>Throws</dt>
                  <dd className={metaValue}>{throwsLabel}</dd>
                </div>
              ) : null}
              {positionsLine ? (
                <div className="text-right">
                  <dt className={metaKicker}>Pos</dt>
                  <dd className={`${metaValue} text-[var(--accent)]`}>{positionsLine}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
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
