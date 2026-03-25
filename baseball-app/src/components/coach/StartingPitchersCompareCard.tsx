"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCoachGamePasAction } from "@/app/coach/actions";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import type { PitchingStats, PlateAppearance } from "@/lib/types";

export type StarterCompareDisplay = {
  name: string;
  handLabel: string | null;
  playerId: string | null;
} | null;

export interface StartingPitchersCompareCardProps {
  gameId: string;
  initialGamePas: PlateAppearance[];
  club: { display: StarterCompareDisplay };
  opponent: { display: StarterCompareDisplay };
}

function hasPitchingLine(s: PitchingStats | null): boolean {
  if (!s) return false;
  return s.rates.pa > 0 || s.ip > 0;
}

function fmtEra(s: PitchingStats): string {
  if (!hasPitchingLine(s)) return "—";
  return s.era.toFixed(2);
}

function fmtIp(s: PitchingStats): string {
  if (!hasPitchingLine(s)) return "—";
  return s.ipDisplay;
}

function fmtRate3(s: PitchingStats, v: number): string {
  if (!hasPitchingLine(s)) return "—";
  return v.toFixed(2);
}

function fmtPct(s: PitchingStats, pct: number): string {
  if (!hasPitchingLine(s)) return "—";
  return `${(pct * 100).toFixed(1)}%`;
}

type RowDef = {
  label: string;
  left: (s: PitchingStats) => string;
  right: (s: PitchingStats) => string;
  better: "lower" | "higher" | null;
};

const ROWS: RowDef[] = [
  {
    label: "ERA",
    left: fmtEra,
    right: fmtEra,
    better: "lower",
  },
  {
    label: "IP",
    left: (s) => fmtIp(s),
    right: (s) => fmtIp(s),
    better: null,
  },
  {
    label: "WHIP",
    left: (s) => fmtRate3(s, s.whip),
    right: (s) => fmtRate3(s, s.whip),
    better: "lower",
  },
  {
    label: "FIP",
    left: (s) => fmtRate3(s, s.fip),
    right: (s) => fmtRate3(s, s.fip),
    better: "lower",
  },
  {
    label: "SO",
    left: (s) => String(s.so),
    right: (s) => String(s.so),
    better: "higher",
  },
  {
    label: "BB",
    left: (s) => String(s.bb),
    right: (s) => String(s.bb),
    better: "lower",
  },
  {
    label: "K%",
    left: (s) => fmtPct(s, s.rates.kPct),
    right: (s) => fmtPct(s, s.rates.kPct),
    better: "higher",
  },
  {
    label: "BB%",
    left: (s) => fmtPct(s, s.rates.bbPct),
    right: (s) => fmtPct(s, s.rates.bbPct),
    better: "lower",
  },
  {
    label: "H",
    left: (s) => String(s.h),
    right: (s) => String(s.h),
    better: "lower",
  },
  {
    label: "HR",
    left: (s) => String(s.hr),
    right: (s) => String(s.hr),
    better: "lower",
  },
];

function parseCompare(
  left: string,
  right: string,
  better: "lower" | "higher" | null
): { boldLeft: boolean; boldRight: boolean } {
  if (!better || left === "—" || right === "—") return { boldLeft: false, boldRight: false };
  const nl = Number(left.replace(/[^0-9.-]/g, ""));
  const nr = Number(right.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(nl) || Number.isNaN(nr)) return { boldLeft: false, boldRight: false };
  if (nl === nr) return { boldLeft: false, boldRight: false };
  if (better === "lower") {
    return nl < nr ? { boldLeft: true, boldRight: false } : { boldLeft: false, boldRight: true };
  }
  return nl > nr ? { boldLeft: true, boldRight: false } : { boldLeft: false, boldRight: true };
}

function starterTitle(d: StarterCompareDisplay) {
  if (!d?.name?.trim()) return "Not set";
  const nameClass =
    "font-medium text-[var(--neo-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)]/40 rounded-sm";
  const nameEl =
    d.playerId != null ? (
      <Link href={`/coach/players/${d.playerId}`} className={nameClass}>
        {d.name}
      </Link>
    ) : (
      <span className="text-[var(--neo-accent)]">{d.name}</span>
    );
  return (
    <>
      {nameEl}
      {d.handLabel ? (
        <>
          <span className="text-[var(--neo-text-muted)]"> · </span>
          <span className="text-white">{d.handLabel}</span>
        </>
      ) : null}
    </>
  );
}

function pitchingStatsForPitcherFromGamePAs(
  pas: PlateAppearance[],
  pitcherId: string | null
): PitchingStats | null {
  if (!pitcherId) return null;
  const filtered = pas.filter((p) => p.pitcher_id === pitcherId);
  const withSplits = pitchingStatsFromPAs(filtered, new Set(), new Map());
  return withSplits?.overall ?? null;
}

const LIVE_POLL_MS = 25_000;

function StartingPitchersLiveSection({
  gameId,
  clubStarterId,
  oppStarterId,
  clubDisplay,
  oppDisplay,
  initialPas,
}: {
  gameId: string;
  clubStarterId: string | null;
  oppStarterId: string | null;
  clubDisplay: StarterCompareDisplay;
  oppDisplay: StarterCompareDisplay;
  initialPas: PlateAppearance[];
}) {
  const [pas, setPas] = useState<PlateAppearance[]>(initialPas);

  useEffect(() => {
    setPas(initialPas);
  }, [initialPas]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchCoachGamePasAction(gameId);
        if (!cancelled && next) setPas(next);
      } catch {
        /* keep last known PAS */
      }
    };
    const id = setInterval(tick, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [gameId]);

  const ls = pitchingStatsForPitcherFromGamePAs(pas, clubStarterId);
  const rs = pitchingStatsForPitcherFromGamePAs(pas, oppStarterId);

  return (
    <CompareStatTable clubDisplay={clubDisplay} oppDisplay={oppDisplay} clubStats={ls} oppStats={rs} />
  );
}

/** Side-by-side stat grid (one pair of pitchers). */
function CompareStatTable({
  clubDisplay,
  oppDisplay,
  clubStats,
  oppStats,
}: {
  clubDisplay: StarterCompareDisplay;
  oppDisplay: StarterCompareDisplay;
  clubStats: PitchingStats | null;
  oppStats: PitchingStats | null;
}) {
  const ls = clubStats;
  const rs = oppStats;

  return (
    <>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] gap-x-2 border-b border-[var(--neo-border)] pb-3 text-center text-sm">
        <div className="min-w-0 font-semibold leading-snug">{starterTitle(clubDisplay)}</div>
        <div className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--neo-accent)] sm:w-16">
          Stat
        </div>
        <div className="min-w-0 font-semibold leading-snug">{starterTitle(oppDisplay)}</div>
      </div>
      <div className="mt-0 flex min-h-0 flex-1 flex-col">
        <div className="divide-y divide-[var(--neo-border)]">
          {ROWS.map((row, i) => {
            const leftStr = ls && hasPitchingLine(ls) ? row.left(ls) : "—";
            const rightStr = rs && hasPitchingLine(rs) ? row.right(rs) : "—";
            const { boldLeft, boldRight } =
              ls && rs && hasPitchingLine(ls) && hasPitchingLine(rs)
                ? parseCompare(leftStr, rightStr, row.better)
                : { boldLeft: false, boldRight: false };
            const zebra = i % 2 === 1 ? "bg-[var(--accent-coach)]/[0.06]" : "bg-transparent";

            return (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr_auto_1fr] gap-x-2 py-2 text-sm ${zebra}`}
              >
                <div
                  className={`min-w-0 text-right tabular-nums text-[var(--neo-text)] ${
                    boldLeft ? "font-bold" : ""
                  }`}
                >
                  {leftStr}
                </div>
                <div className="w-14 shrink-0 text-center text-xs font-bold text-[var(--neo-accent)] sm:w-16">
                  {row.label}
                </div>
                <div
                  className={`min-w-0 text-left tabular-nums text-[var(--neo-text)] ${
                    boldRight ? "font-bold" : ""
                  }`}
                >
                  {rightStr}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function StartingPitchersCompareCard({
  gameId,
  initialGamePas,
  club,
  opponent,
}: StartingPitchersCompareCardProps) {
  const clubStarterId = club.display?.playerId ?? null;
  const oppStarterId = opponent.display?.playerId ?? null;

  return (
    <div className="neo-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4 lg:p-5">
      <div className="section-label mb-3">Starting pitchers</div>

      <div className="flex min-h-0 flex-1 flex-col">
        <StartingPitchersLiveSection
          gameId={gameId}
          clubStarterId={clubStarterId}
          oppStarterId={oppStarterId}
          clubDisplay={club.display}
          oppDisplay={opponent.display}
          initialPas={initialGamePas}
        />
        <div className="min-h-0 flex-1" aria-hidden />
      </div>
    </div>
  );
}
