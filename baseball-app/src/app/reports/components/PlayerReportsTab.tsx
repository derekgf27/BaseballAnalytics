"use client";

import Link from "next/link";
import { HitterProfileExportButton } from "@/components/shared/HitterProfileExportButton";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { formatPositionsDisplay } from "@/lib/playerRoster";
import type { BattingStatsWithSplits, Player } from "@/lib/types";

function handLabel(bats: string | null | undefined): string | null {
  if (bats == null || bats === "") return null;
  const code = bats.toUpperCase();
  if (code.startsWith("L")) return "Left";
  if (code.startsWith("R")) return "Right";
  if (code.startsWith("S")) return "Switch";
  return bats;
}

function playerMetaLine(player: Player): string | null {
  const parts: string[] = [];
  const bats = handLabel(player.bats);
  if (bats) parts.push(`Bats ${bats}`);
  const pos = player.positions?.length ? formatPositionsDisplay(player) : null;
  if (pos) parts.push(pos);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PlayerReportsTab({
  roster,
  statsByPlayerId,
  statsLoading = false,
}: {
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
  statsLoading?: boolean;
}) {
  if (roster.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
        No hitters on the club roster.
      </p>
    );
  }

  if (statsLoading) {
    return (
      <div
        className="animate-pulse rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-base text-[var(--text-muted)]"
        aria-busy="true"
        aria-label="Loading batter stats"
      >
        Loading season stats for export…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        Each row exports the same hitter profile PDF as{" "}
        <span className="font-semibold text-[var(--text)]">Export report</span> on the analyst player profile.
      </p>
      <ul className="space-y-2">
        {roster.map((p) => {
          const meta = playerMetaLine(p);
          const hasBatting = statsByPlayerId[p.id] != null;

          return (
            <li
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"
            >
              <div className="flex w-full flex-wrap items-center gap-3 sm:gap-4">
                {p.jersey != null && String(p.jersey).trim() !== "" ? (
                  <span className="font-orbitron text-2xl font-semibold tabular-nums tracking-tight text-[var(--accent)] sm:text-3xl">
                    #{p.jersey}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <Link
                    href={analystPlayerProfileHref(p.id)}
                    className="font-display text-lg font-semibold text-[var(--text)] hover:text-[var(--accent)] sm:text-xl"
                  >
                    {p.name}
                  </Link>
                  {meta ? <p className="text-sm text-[var(--text-muted)]">{meta}</p> : null}
                </div>
                <div className="ml-auto flex shrink-0 items-center">
                  <HitterProfileExportButton player={p} enabled={hasBatting} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
