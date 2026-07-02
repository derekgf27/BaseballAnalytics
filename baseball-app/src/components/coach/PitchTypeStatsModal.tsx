"use client";

import { useEffect, type ReactNode } from "react";
import type { PitchTypeGameDetail } from "@/lib/compute/pitchTypeGameDetail";
import { formatPitchTypeBaa, formatPitchTypeRate } from "@/lib/pitchTypeBaaDisplay";
import {
  pitchTrackerAbbrev,
  pitchTrackerTypeChipClass,
  pitchTrackerTypeLabel,
} from "@/lib/pitchTrackerUi";

function pitchTypeModalPct(rate: number | null): string {
  if (rate == null) return "—";
  const pct = Math.round(rate * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Percentage with underlying count fraction, e.g. `65% (13/20)`. */
function pitchTypeModalPctWithCount(
  rate: number | null,
  num: number,
  den: number
): string {
  if (den <= 0 || rate == null) return "—";
  return `${pitchTypeModalPct(rate)} (${num}/${den})`;
}

type PitchTypeStatRow = { label: string; value: ReactNode; title?: string };

/** Scorecard-style rows — visually distinct from the pad’s stacked mini-card tiles. */
function PitchTypeStatSheetSection({ title, rows }: { title: string; rows: PitchTypeStatRow[] }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={title}>
      <h3 className="pitch-pad-accent mb-1.5 shrink-0 border-l-4 border-[var(--accent)] pl-2 font-display text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-xs md:mb-2 md:pl-2.5 md:text-sm xl:mb-1.5 xl:pl-2 xl:text-xs">
        {title}
      </h3>
      <dl className="pitch-pad-surface min-h-0 flex-1 divide-y divide-[var(--border)] rounded-lg ring-1 ring-[var(--border)]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 px-2 py-1.5 sm:px-2.5 sm:py-2 md:gap-1 md:px-3 md:py-2.5 xl:gap-0.5 xl:px-2.5 xl:py-2"
            title={row.title}
          >
            <dt className="min-w-0 text-[11px] font-medium leading-snug text-[var(--text-muted)] sm:text-xs md:text-sm xl:text-xs">
              {row.label}
            </dt>
            <dd className="pitch-pad-accent tabular-nums text-sm font-bold leading-none sm:text-base md:text-lg xl:text-base">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Tap a pitch-type chip → every in-game stat for that pitch (current pitcher). */
export function PitchTypeStatsModal({
  detail,
  pitcherName,
  onClose,
}: {
  detail: PitchTypeGameDetail;
  pitcherName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-2 lg:p-3 xl:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${pitchTrackerTypeLabel(d.type)} stats this game`}
    >
      <button
        type="button"
        className="modal-overlay absolute inset-0 cursor-pointer backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close pitch type stats"
      />
      <div className="coach-pitch-pad relative flex max-h-[min(88dvh,44rem)] w-[min(98vw,88rem)] flex-col overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[var(--bg-card)] shadow-[var(--shadow-toast)] ring-1 ring-[color-mix(in_srgb,var(--accent)_12%,transparent)] md:max-h-[96dvh] md:min-h-[86dvh] md:w-[99vw] lg:max-h-[96dvh] lg:min-h-[88dvh] xl:max-h-[min(88dvh,44rem)] xl:min-h-0 xl:w-[min(94vw,88rem)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5 sm:py-4 md:gap-4 md:px-6 md:py-4 xl:px-5 xl:py-4">
          <span
            className={`inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold shadow-md sm:h-11 sm:w-16 sm:text-base md:h-12 md:w-[4.5rem] md:text-lg xl:h-11 xl:w-16 xl:text-base ${pitchTrackerTypeChipClass(d.type)}`}
          >
            {pitchTrackerAbbrev(d.type)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 font-display text-xl font-bold leading-tight text-[var(--text)] sm:text-2xl md:text-3xl xl:text-2xl">
              <span className="shrink-0">{pitchTrackerTypeLabel(d.type)}</span>
              <span className="shrink-0 font-normal text-[var(--text-faint)]" aria-hidden>
                ·
              </span>
              <span className="min-w-0 truncate text-[var(--text)]">{pitcherName}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pitch-pad-btn-secondary touch-manipulation inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border text-lg font-bold leading-none transition active:opacity-90 md:h-12 md:w-12 xl:h-10 xl:w-10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-5 xl:px-5 xl:py-5">
          {d.thrown === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              No {pitchTrackerTypeLabel(d.type).toLowerCase()} logged for {pitcherName} yet this
              game.
            </p>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-row items-stretch gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-3">
              <PitchTypeStatSheetSection
                title="Usage"
                rows={[
                  { label: "Thrown", value: d.thrown, title: "Pitches of this type in the log" },
                  {
                    label: "Mix %",
                    value: pitchTypeModalPct(d.mixPct),
                    title: "Share of all typed pitches",
                  },
                  { label: "First pitch (0-0)", value: d.firstPitches },
                  {
                    label: "FPS %",
                    value: pitchTypeModalPctWithCount(
                      d.firstPitchStrikePct,
                      d.firstPitchStrikes,
                      d.firstPitches
                    ),
                    title: "First-pitch strikes ÷ first pitches (0-0)",
                  },
                  { label: "Ahead in count", value: d.ahead },
                  { label: "Even count", value: d.even },
                  { label: "Behind in count", value: d.behind },
                ]}
              />
              <PitchTypeStatSheetSection
                title="Results"
                rows={[
                  {
                    label: "Strike %",
                    value: pitchTypeModalPct(d.strikePct),
                    title: "Strikes ÷ thrown",
                  },
                  {
                    label: "CSW %",
                    value: pitchTypeModalPct(d.cswPct),
                    title: "Called + whiffs ÷ thrown",
                  },
                  { label: "Balls", value: d.balls },
                  { label: "Called strikes", value: d.calledStrikes },
                  { label: "Whiffs", value: d.swingingStrikes },
                  { label: "Fouls", value: d.fouls },
                  { label: "In play", value: d.inPlay },
                ]}
              />
              <PitchTypeStatSheetSection
                title="Swings"
                rows={[
                  { label: "Swing %", value: pitchTypeModalPct(d.swingPct) },
                  { label: "Whiff %", value: pitchTypeModalPct(d.whiffPct) },
                  {
                    label: "Contact %",
                    value: pitchTypeModalPct(d.contactPct),
                    title: "Swings that made contact ÷ swings",
                  },
                  { label: "Foul %", value: pitchTypeModalPct(d.foulPct) },
                ]}
              />
              <PitchTypeStatSheetSection
                title="2 strikes"
                rows={[
                  {
                    label: "Pitches",
                    value: d.twoStrikePitches,
                    title: "Thrown with 2 strikes on the batter",
                  },
                  {
                    label: "Swing %",
                    value: pitchTypeModalPct(d.twoStrikeSwingPct),
                    title: "Swings ÷ pitches at 2 strikes",
                  },
                  {
                    label: "Whiff %",
                    value: pitchTypeModalPct(d.twoStrikeWhiffPct),
                    title: "Whiffs ÷ swings at 2 strikes",
                  },
                  {
                    label: "Contact %",
                    value: pitchTypeModalPct(d.twoStrikeContactPct),
                    title: "Contact ÷ swings at 2 strikes",
                  },
                  {
                    label: "Foul %",
                    value: pitchTypeModalPct(d.twoStrikeFoulPct),
                    title: "Fouls ÷ pitches at 2 strikes",
                  },
                  {
                    label: "Putaway %",
                    value: pitchTypeModalPct(d.putawayPct),
                    title: "Strikeouts on this pitch ÷ pitches at 2 strikes",
                  },
                ]}
              />
              <PitchTypeStatSheetSection
                title="vs Hitters"
                rows={[
                  {
                    label: "BAA",
                    value: formatPitchTypeBaa(d.baa ?? undefined),
                    title: "Hits ÷ at-bats that ended on this pitch",
                  },
                  {
                    label: "SLG",
                    value: formatPitchTypeRate(d.slg ?? undefined),
                    title: "Slugging on at-bats that ended on this pitch",
                  },
                  {
                    label: "K%",
                    value: pitchTypeModalPct(d.kPct),
                    title: "Strikeouts ÷ (AB + SO) on this pitch",
                  },
                  {
                    label: "BB%",
                    value: pitchTypeModalPct(d.bbPct),
                    title: "Walks + HBP ÷ PAs ended on this pitch",
                  },
                  {
                    label: "AB / H",
                    value: d.abAgainst > 0 ? `${d.hitsAgainst}/${d.abAgainst}` : "—",
                    title: "At-bats and hits that ended on this pitch",
                  },
                  { label: "Home runs", value: d.hrAgainst },
                ]}
              />
              <PitchTypeStatSheetSection
                title="ABs ended on this pitch"
                rows={[
                  { label: "Plate appearances", value: d.paEnded },
                  { label: "Strikeouts", value: d.endKs },
                  { label: "Walks", value: d.endWalks },
                  { label: "Hits", value: d.endHits },
                  { label: "Outs", value: d.endOuts },
                  { label: "Other", value: d.endOther },
                ]}
              />
              <PitchTypeStatSheetSection
                title="Balls in play"
                rows={[
                  {
                    label: "GB %",
                    value: pitchTypeModalPctWithCount(d.bipGbPct, d.bipGb, d.bipTagged),
                    title: "Ground balls ÷ tagged balls in play",
                  },
                  {
                    label: "LD %",
                    value: pitchTypeModalPctWithCount(d.bipLdPct, d.bipLd, d.bipTagged),
                    title: "Line drives ÷ tagged balls in play",
                  },
                  {
                    label: "FB %",
                    value: pitchTypeModalPctWithCount(d.bipFbPct, d.bipFb, d.bipTagged),
                    title: "Fly balls ÷ tagged balls in play",
                  },
                  {
                    label: "IFF %",
                    value: pitchTypeModalPctWithCount(d.bipIffPct, d.bipIff, d.bipTagged),
                    title: "Infield flies ÷ tagged balls in play",
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
