"use client";

import Link from "next/link";
import type { PitchingStats } from "@/lib/types";

export type StarterCompareDisplay = {
  name: string;
  handLabel: string | null;
  playerId: string | null;
} | null;

export interface StartingPitchersCompareCardProps {
  club: { display: StarterCompareDisplay };
  opponent: { display: StarterCompareDisplay };
  /** Our starter: all PAs in the app (left column). */
  clubSeasonPitching: PitchingStats | null;
  /** Opponent starter: PAs vs our lineup side only (cumulative). */
  opponentVsOurClubPitching: PitchingStats | null;
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

function fmtStrikePct(s: PitchingStats): string {
  if (!hasPitchingLine(s)) return "—";
  const v = s.rates.strikePct;
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtFpsPct(s: PitchingStats): string {
  if (!hasPitchingLine(s)) return "—";
  const v = s.rates.fpsPct;
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtPpa(s: PitchingStats): string {
  if (!hasPitchingLine(s)) return "—";
  const v = s.rates.pPa;
  if (v == null) return "—";
  return v.toFixed(1);
}

type RowDef = {
  label: string;
  left: (s: PitchingStats) => string;
  right: (s: PitchingStats) => string;
  better: "lower" | "higher" | null;
};

/** Same stat order as Record PA pitching box + common rate lines (from PA pitch counts where available). */
const ROWS: RowDef[] = [
  { label: "IP", left: fmtIp, right: fmtIp, better: null },
  { label: "H", left: (s) => String(s.h), right: (s) => String(s.h), better: "lower" },
  { label: "R", left: (s) => String(s.r), right: (s) => String(s.r), better: "lower" },
  { label: "ER", left: (s) => String(s.er), right: (s) => String(s.er), better: "lower" },
  { label: "BB", left: (s) => String(s.bb), right: (s) => String(s.bb), better: "lower" },
  { label: "K", left: (s) => String(s.so), right: (s) => String(s.so), better: "higher" },
  { label: "HR", left: (s) => String(s.hr), right: (s) => String(s.hr), better: "lower" },
  { label: "ERA", left: fmtEra, right: fmtEra, better: "lower" },
  { label: "WHIP", left: (s) => fmtRate3(s, s.whip), right: (s) => fmtRate3(s, s.whip), better: "lower" },
  { label: "FIP", left: (s) => fmtRate3(s, s.fip), right: (s) => fmtRate3(s, s.fip), better: "lower" },
  { label: "HBP", left: (s) => String(s.hbp), right: (s) => String(s.hbp), better: "lower" },
  { label: "K%", left: (s) => fmtPct(s, s.rates.kPct), right: (s) => fmtPct(s, s.rates.kPct), better: "higher" },
  { label: "BB%", left: (s) => fmtPct(s, s.rates.bbPct), right: (s) => fmtPct(s, s.rates.bbPct), better: "lower" },
  { label: "Strike%", left: fmtStrikePct, right: fmtStrikePct, better: "higher" },
  { label: "FPS%", left: fmtFpsPct, right: fmtFpsPct, better: "higher" },
  { label: "P/PA", left: fmtPpa, right: fmtPpa, better: "lower" },
];

function compareStatValue(value: string) {
  return value === "—" ? (
    <span className="tabular-nums text-zinc-600">—</span>
  ) : (
    value
  );
}

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

/** Side-by-side stat grid (one pair of pitchers). */
function CompareStatTable({
  clubDisplay,
  oppDisplay,
  clubStats,
  oppStats,
  highlightCompare = true,
}: {
  clubDisplay: StarterCompareDisplay;
  oppDisplay: StarterCompareDisplay;
  clubStats: PitchingStats | null;
  oppStats: PitchingStats | null;
  /** When false, do not bold "better" cells (e.g. different sample bases). */
  highlightCompare?: boolean;
}) {
  const ls = clubStats;
  const rs = oppStats;

  return (
    <>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] gap-x-2 border-b border-[var(--neo-border)] pb-3 text-center text-sm">
        <div className="min-w-0 font-semibold leading-snug">
          {starterTitle(clubDisplay)}
          <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-zinc-500">
            Season (all games)
          </p>
        </div>
        <div className="w-[4.25rem] shrink-0 self-end pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--neo-accent)] sm:w-[4.5rem]">
          Stat
        </div>
        <div className="min-w-0 font-semibold leading-snug">
          {starterTitle(oppDisplay)}
          <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-zinc-500">
            Vs our team (cumulative)
          </p>
        </div>
      </div>
      <div className="mt-0 flex min-h-0 flex-1 flex-col">
        <div className="divide-y divide-[var(--neo-border)]">
          {ROWS.map((row, i) => {
            const leftStr = ls && hasPitchingLine(ls) ? row.left(ls) : "—";
            const rightStr = rs && hasPitchingLine(rs) ? row.right(rs) : "—";
            const { boldLeft, boldRight } =
              highlightCompare && ls && rs && hasPitchingLine(ls) && hasPitchingLine(rs)
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
                  {compareStatValue(leftStr)}
                </div>
                <div className="w-[4.25rem] shrink-0 text-center text-[10px] font-bold leading-tight text-[var(--neo-accent)] sm:w-[4.5rem] sm:text-xs">
                  {row.label}
                </div>
                <div
                  className={`min-w-0 text-left tabular-nums text-[var(--neo-text)] ${
                    boldRight ? "font-bold" : ""
                  }`}
                >
                  {compareStatValue(rightStr)}
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
  club,
  opponent,
  clubSeasonPitching,
  opponentVsOurClubPitching,
}: StartingPitchersCompareCardProps) {
  return (
    <div className="neo-card flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden p-4 lg:p-5">
      <div className="section-label mb-3">Starting pitchers</div>

      <div className="flex min-h-0 flex-1 flex-col">
        <CompareStatTable
          clubDisplay={club.display}
          oppDisplay={opponent.display}
          clubStats={clubSeasonPitching}
          oppStats={opponentVsOurClubPitching}
          highlightCompare={false}
        />
      </div>
    </div>
  );
}
