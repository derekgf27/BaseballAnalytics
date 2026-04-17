"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCoachGamePasAction } from "@/app/coach/actions";
import { BattingPitchMixCard } from "@/components/analyst/BattingPitchMixCard";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import type { PitchEvent, PitchingStats, Player, PlateAppearance } from "@/lib/types";

export type StarterCompareDisplay = {
  name: string;
  handLabel: string | null;
  playerId: string | null;
} | null;

export interface StartingPitchersCompareCardProps {
  gameId: string;
  initialGamePas: PlateAppearance[];
  /** Same pitch log as Record PA (enables Sw%, BIP mix, etc. in pitch data cards). */
  initialGamePitchEvents: PitchEvent[];
  coachPitchPlayers: Player[];
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

function pitchingStatsForPitcherFromGamePAs(
  allPas: PlateAppearance[],
  pitcherId: string | null
): PitchingStats | null {
  if (!pitcherId) return null;
  const filtered = allPas.filter((p) => p.pitcher_id === pitcherId);
  const withSplits = pitchingStatsFromPAs(filtered, new Set(), new Map(), new Map(), {
    allPasForRunCharges: allPas,
  });
  return withSplits?.overall ?? null;
}

/** Same three blocks as Record PA pitch data, with placeholders when there is no sample yet. */
function EmptyPitchDataPreview({ caption }: { caption: string }) {
  const grid =
    "grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-tight sm:text-xs text-zinc-400";
  const lab = (t: string) => (
    <span className="shrink-0 font-semibold text-zinc-500" title={t}>
      {t}
    </span>
  );
  const dash = <span className="tabular-nums text-zinc-600">—</span>;
  const mini = (title: string, children: ReactNode) => (
    <div className="rounded-md border border-zinc-800/90 bg-zinc-900/35 px-2 py-1.5 sm:px-2.5 sm:py-2">
      <p className="mb-0.5 font-display text-[8px] font-semibold uppercase tracking-wider text-white/75">{title}</p>
      {children}
    </div>
  );
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/45 px-2 py-2 sm:px-2.5 sm:py-2.5">
      <p className="font-display text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Pitch data</p>
      <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">{caption}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
        {mini(
          "Rates",
          <div className={grid} role="group" aria-label="Rates (empty)">
            {lab("FPS:")}
            {dash}
            {lab("Strike %:")}
            {dash}
            {lab("Balls:")}
            {dash}
            {lab("Strikes:")}
            {dash}
            {lab("Pitches:")}
            {dash}
            {lab("P/PA:")}
            {dash}
            {lab("LOB:")}
            {dash}
          </div>
        )}
        {mini(
          "Contact",
          <div className={`${grid} min-h-[2.75rem] items-center`} role="group" aria-label="Contact (empty)">
            <span className="col-span-2 text-center font-medium tabular-nums text-zinc-600">—</span>
          </div>
        )}
        {mini(
          "2 strikes",
          <div className={`${grid} items-center`} role="group" aria-label="Two strikes (empty)">
            <span className="col-span-2 text-center font-medium tabular-nums text-zinc-600">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

const LIVE_POLL_MS = 25_000;

function StartingPitchersLiveSection({
  gameId,
  clubStarterId,
  oppStarterId,
  clubDisplay,
  oppDisplay,
  initialPas,
  gamePitchEvents,
  players,
}: {
  gameId: string;
  clubStarterId: string | null;
  oppStarterId: string | null;
  clubDisplay: StarterCompareDisplay;
  oppDisplay: StarterCompareDisplay;
  initialPas: PlateAppearance[];
  gamePitchEvents: PitchEvent[];
  players: Player[];
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
    <>
      <CompareStatTable clubDisplay={clubDisplay} oppDisplay={oppDisplay} clubStats={ls} oppStats={rs} />
      <div className="mt-4 min-h-0 space-y-3 border-t border-[var(--neo-border)] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Pitch data (this game)
        </p>
        <div className="grid min-h-0 min-w-0 gap-3 lg:grid-cols-2">
          {clubStarterId ? (
            <div className="min-w-0 overflow-x-auto">
              <BattingPitchMixCard
                pas={pas}
                players={players}
                pitchEvents={gamePitchEvents}
                compact
                currentPitcherId={clubStarterId}
              />
            </div>
          ) : (
            <EmptyPitchDataPreview caption="Set our starter on Analyst → Games to link this column to a pitcher." />
          )}
          {oppStarterId ? (
            <div className="min-w-0 overflow-x-auto">
              <BattingPitchMixCard
                pas={pas}
                players={players}
                pitchEvents={gamePitchEvents}
                compact
                currentPitcherId={oppStarterId}
              />
            </div>
          ) : (
            <EmptyPitchDataPreview caption="Set the opponent starter on Analyst → Games." />
          )}
        </div>
      </div>
    </>
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
        <div className="w-[4.25rem] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--neo-accent)] sm:w-[4.5rem]">
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
  gameId,
  initialGamePas,
  initialGamePitchEvents,
  coachPitchPlayers,
  club,
  opponent,
}: StartingPitchersCompareCardProps) {
  const clubStarterId = club.display?.playerId ?? null;
  const oppStarterId = opponent.display?.playerId ?? null;

  return (
    <div className="neo-card flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden p-4 lg:p-5">
      <div className="section-label mb-3">Starting pitchers</div>

      <div className="flex min-h-0 flex-1 flex-col">
        <StartingPitchersLiveSection
          gameId={gameId}
          clubStarterId={clubStarterId}
          oppStarterId={oppStarterId}
          clubDisplay={club.display}
          oppDisplay={opponent.display}
          initialPas={initialGamePas}
          gamePitchEvents={initialGamePitchEvents}
          players={coachPitchPlayers}
        />
      </div>
    </div>
  );
}
