"use client";

import { useMemo, type ReactNode } from "react";
import {
  aggregatePitchMixExtrasFromPas,
  aggregateTwoStrikePitchAggFromPas,
  groupPitchEventsByPaId,
  type PitchMixExtrasAgg,
  type TwoStrikePitchAgg,
} from "@/lib/compute/contactProfileFromPas";
import { COACH_LIVE_AB_PA_ID } from "@/lib/compute/pitchTrackerCount";
import {
  pitchMixFromPlateAppearancesOrPitchLog,
  type PitchMixRates,
} from "@/lib/compute/battingStats";
import {
  pitchTypeDistributionFromPitchLog,
  type PitchTypeDistributionResult,
} from "@/lib/compute/pitchTypeDistributionFromPitchLog";
import { formatBatterGameStatLine } from "@/lib/format/batterGameLine";
import { platoonPitchMixDistributions } from "@/lib/compute/gamePasIndexes";
import { pitchTrackerAbbrev, pitchTrackerTypeChipClass, pitchTrackerTypeLabel } from "@/lib/pitchTrackerUi";
import type { Bats, PitchEvent, PitchTrackerPitchType, PlateAppearance, Player } from "@/lib/types";

const RESULT_ADDS_ONE_OUT = new Set<PlateAppearance["result"]>([
  "out",
  "so",
  "so_looking",
  "sac",
  "sac_fly",
  "sac_bunt",
]);

function paChronological(a: PlateAppearance, b: PlateAppearance): number {
  if (a.inning !== b.inning) return a.inning - b.inning;
  const ha = a.inning_half === "top" ? 0 : 1;
  const hb = b.inning_half === "top" ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

export function pitcherIdsInOrder(pas: PlateAppearance[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const pa of [...pas].sort(paChronological)) {
    if (!pa.pitcher_id || seen.has(pa.pitcher_id)) continue;
    seen.add(pa.pitcher_id);
    ids.push(pa.pitcher_id);
  }
  return ids;
}

/** Stat numbers in pitch mix cards — always true accent (not `--accent-text` remap). */
const PITCH_MIX_STAT_VAL = "pitch-mix-stat-value";
const PITCH_MIX_STAT_VAL_SUB = "pitch-mix-stat-value-sub";
const PITCH_MIX_NAME = "pitch-mix-name";

/** Shared shell for the Record batter / pitcher pitch-data pair (equal padding, stretch in grid). */
function pitchDataPairCardShellClass(
  compact: boolean,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false
): string {
  if (coachPad && coachPadExpanded) {
    return "batting-pitch-mix-card-root flex h-full min-h-0 min-w-0 flex-col px-1 py-1 md:px-2 md:py-2";
  }
  const pad = compact
    ? coachPad
      ? coachPadDense
        ? "px-1.5 py-1 md:px-2 md:py-1.5"
        : "px-2 py-1.5 md:px-3 md:py-2.5"
      : "px-2 py-1.5"
    : "px-2.5 py-2";
  return `batting-pitch-mix-card-root rounded-lg border border-[var(--border)] bg-[var(--bg-card)] ${pad} flex h-full min-h-0 min-w-0 flex-col`;
}

function pitchDataCardNameClass(
  compact: boolean,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false
): string {
  const size =
    coachPad && coachPadExpanded
      ? "text-lg md:text-xl"
      : coachPad && coachPadDense
        ? "text-xs sm:text-sm md:text-base"
        : coachPad
          ? "text-sm sm:text-base lg:text-lg"
          : compact
            ? "text-sm sm:text-base"
            : "text-base sm:text-lg";
  return `truncate font-display font-bold ${PITCH_MIX_NAME} ${size}`;
}

function pitchDataCardHeaderStatClass(
  compact: boolean,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false
): string {
  const size =
    coachPad && coachPadExpanded
      ? "text-base md:text-lg"
      : coachPad && coachPadDense
        ? "text-xs sm:text-sm md:text-base"
        : coachPad
          ? "text-sm sm:text-base lg:text-lg"
          : compact
            ? "text-sm sm:text-base"
            : "text-base sm:text-lg";
  return `min-w-0 flex-1 text-right font-semibold tabular-nums leading-tight text-[var(--text)] ${size}`;
}

/**
 * Coach pad stacked-tile scale: "lg" for the full-game strip, "md" for the
 * (slightly shorter) matchup card so two tile rows always fit without scrolling.
 */
type CoachPadTileScale = false | "md" | "lg";

const coachPadTileScale = (
  coachPadExpanded: boolean,
  coachPadFullGame: boolean
): CoachPadTileScale => (coachPadFullGame ? "lg" : coachPadExpanded ? "md" : false);

function coachPadStatTypography(coachPadExpanded: boolean, tiles: CoachPadTileScale = false) {
  if (tiles === "lg") {
    return {
      label:
        "shrink-0 font-display font-semibold uppercase tracking-wider text-white text-[9px] leading-none md:text-[10px]",
      val: `tabular-nums font-bold leading-none ${PITCH_MIX_STAT_VAL} text-xl md:text-2xl lg:text-3xl`,
      missing:
        "tabular-nums font-medium leading-none text-white text-xl md:text-2xl lg:text-3xl",
      sub: `tabular-nums font-bold ${PITCH_MIX_STAT_VAL_SUB} text-xs leading-none md:text-sm`,
    };
  }
  if (tiles === "md") {
    return {
      label:
        "shrink-0 font-display font-semibold uppercase tracking-wider text-white text-[9px] leading-none md:text-[10px]",
      val: `tabular-nums font-bold leading-none ${PITCH_MIX_STAT_VAL} text-lg md:text-xl`,
      missing:
        "tabular-nums font-medium leading-none text-white text-lg md:text-xl",
      sub: `tabular-nums font-bold ${PITCH_MIX_STAT_VAL_SUB} text-[10px] leading-none md:text-[11px]`,
    };
  }
  return {
    label: coachPadExpanded
      ? "shrink-0 font-semibold text-white text-xs leading-none md:text-sm"
      : "shrink-0 font-semibold text-white",
    val: coachPadExpanded
      ? `tabular-nums font-bold leading-none ${PITCH_MIX_STAT_VAL} text-base md:text-lg`
      : `tabular-nums font-bold ${PITCH_MIX_STAT_VAL}`,
    missing: coachPadExpanded
      ? "tabular-nums font-medium leading-none text-white text-base md:text-lg"
      : "tabular-nums font-medium text-white",
    sub: coachPadExpanded
      ? `tabular-nums font-bold ${PITCH_MIX_STAT_VAL_SUB} text-[10px] leading-none md:text-[11px]`
      : `${PITCH_MIX_STAT_VAL_SUB} font-bold`,
  };
}

/**
 * Inline label:value; expanded uses slightly larger type without stacked tiles (avoids grid overlap).
 * Coach pad tile scales stack the label above a much larger value to fill the fixed-height cards.
 */
function coachPadStatWrap(
  coachPadExpanded: boolean,
  label: string,
  title: string,
  compact: boolean,
  value: ReactNode,
  nowrap = false,
  tiles: CoachPadTileScale = false
) {
  const stat = coachPadStatTypography(coachPadExpanded, tiles);
  if (tiles) {
    return (
      <span
        className={`flex min-w-0 max-w-full flex-col items-start leading-none ${
          tiles === "lg" ? "gap-y-1" : "gap-y-0.5"
        }`}
        title={title}
      >
        <span className={stat.label}>{label.replace(/:$/, "")}</span>
        {value}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-baseline gap-x-1 gap-y-0 ${
        nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap"
      } ${coachPadExpanded ? "leading-none" : "leading-snug"}`}
      title={compact && !coachPadExpanded ? undefined : title}
    >
      <span className={stat.label}>{label}</span>
      {value}
    </span>
  );
}

function pitchMixClickableStat(
  onClick: () => void,
  modalTitle: string,
  coachPadExpanded: boolean,
  label: string,
  value: ReactNode,
  tiles: CoachPadTileScale = false
) {
  const stat = coachPadStatTypography(coachPadExpanded, tiles);
  const focusClass =
    "cursor-pointer rounded text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60";
  if (tiles) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={modalTitle}
        className={`flex min-w-0 max-w-full flex-col items-start leading-none ${focusClass} ${
          tiles === "lg" ? "gap-y-1" : "gap-y-0.5"
        }`}
      >
        <span className={stat.label}>{label.replace(/:$/, "")}</span>
        {value}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={modalTitle}
      className={`inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1 gap-y-0 leading-snug ${focusClass}`}
    >
      <span className={stat.label}>{label}</span>
      {value}
    </button>
  );
}

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatPpa(p: number | null): string {
  if (p == null) return "—";
  return p.toFixed(1);
}

function countBaseRunners(baseState: string | null | undefined): number {
  const bits = String(baseState ?? "")
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
  return (bits.match(/1/g) || []).length;
}

/** Pitches thrown by `pitcherId` in the current half-inning (pitch log when available, else `pitches_seen`). */
export function pitchCountForPaFromLog(
  pa: PlateAppearance,
  eventsByPaId: Map<string, PitchEvent[]>
): number {
  const evs = eventsByPaId.get(pa.id);
  if (evs != null && evs.length > 0) return evs.length;
  if (typeof pa.pitches_seen === "number" && pa.pitches_seen > 0) return pa.pitches_seen;
  return 0;
}

export type PitcherInningPitchRow = {
  inning: number;
  pitches: number;
};

/** Pitches thrown by `pitcherId` in each inning (pitch log when available, else `pitches_seen`). */
export function pitchesByInningForPitcher(
  pas: PlateAppearance[],
  pitchEvents: PitchEvent[],
  pitcherId: string
): PitcherInningPitchRow[] {
  const eventsByPaId = groupPitchEventsByPaId(pitchEvents);
  const counts = new Map<number, number>();

  for (const pa of pas) {
    if (pa.pitcher_id !== pitcherId) continue;
    const pitchCount = pitchCountForPaFromLog(pa, eventsByPaId);
    if (pitchCount <= 0) continue;
    counts.set(pa.inning, (counts.get(pa.inning) ?? 0) + pitchCount);
  }

  return [...counts.entries()]
    .map(([inning, pitches]) => ({ inning, pitches }))
    .sort((a, b) => a.inning - b.inning);
}

export function pitchesThisInningForPitcher(
  pas: PlateAppearance[],
  pitchEvents: PitchEvent[],
  pitcherId: string,
  inning: number,
  inningHalf: "top" | "bottom"
): number {
  const half = inningHalf === "bottom" ? "bottom" : "top";
  const inningPas = pas.filter((p) => {
    if (p.pitcher_id !== pitcherId || p.inning !== inning) return false;
    const paHalf = p.inning_half === "bottom" ? "bottom" : "top";
    return paHalf === half;
  });
  const eventsByPaId = groupPitchEventsByPaId(pitchEvents);
  let total = 0;
  for (const pa of inningPas) {
    total += pitchCountForPaFromLog(pa, eventsByPaId);
  }
  return total;
}

export function lobByPitcherFromPas(pas: PlateAppearance[]): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = [...pas].sort(paChronological);
  for (const pa of sorted) {
    if (!pa.pitcher_id) continue;
    const outsBefore = typeof pa.outs === "number" ? pa.outs : 0;
    const outsAdded =
      pa.result === "gidp" ? 2 : RESULT_ADDS_ONE_OUT.has(pa.result) ? 1 : 0;
    if (outsAdded <= 0 || outsBefore + outsAdded < 3) continue;
    let stranded = countBaseRunners(pa.base_state);
    if (pa.result === "gidp") {
      const onFirst = String(pa.base_state ?? "").padStart(3, "0").slice(0, 3)[0] === "1";
      if (onFirst) stranded = Math.max(0, stranded - 1);
    }
    if (stranded <= 0) continue;
    out.set(pa.pitcher_id, (out.get(pa.pitcher_id) ?? 0) + stranded);
  }
  return out;
}

type PitchMixLine = PitchMixRates;

const EMPTY_EXTRAS: PitchMixExtrasAgg = {
  pitchesLogged: 0,
  swings: 0,
  whiffs: 0,
  fouls: 0,
  balls: 0,
  calledStrikes: 0,
  swingingStrikes: 0,
  strikesThrown: 0,
  bipTyped: 0,
  gb: 0,
  ld: 0,
  fb: 0,
  iff: 0,
};

/** Same stat order / 2×2 blocks as coach pitch pad (`coachPad` + `coachPadExpanded`). */
function pitchPadLayoutFlags(pitchPadLayout?: boolean) {
  return pitchPadLayout ? { coachPad: true as const, coachPadExpanded: true as const } : {};
}

const EMPTY_TWO_STRIKE_AGG: TwoStrikePitchAgg = {
  pitchesAtTwoStrikes: 0,
  swingsAtTwoStrikes: 0,
  whiffsAtTwoStrikes: 0,
  foulsAtTwoStrikes: 0,
};

const pitchMixMiniGridClass = (
  compact: boolean,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  coachPadFullGame = false
) =>
  compact
    ? coachPad
      ? coachPadExpanded
        ? coachPadFullGame
          ? "grid grid-cols-3 content-start gap-x-2 gap-y-1.5 md:gap-x-2.5 md:gap-y-2"
          : "grid grid-cols-2 content-start gap-x-2 gap-y-2 md:gap-x-2.5 md:gap-y-2"
        : coachPadDense
          ? "grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] leading-tight sm:gap-x-2.5"
          : "grid grid-cols-2 gap-x-3 gap-y-2 text-xs leading-tight sm:text-sm sm:gap-x-4 lg:text-base lg:leading-snug"
      : "grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-tight sm:text-sm"
    : "grid grid-cols-2 gap-x-4 gap-y-2 text-base leading-tight";

/** Pitch-type mix strip: three columns to avoid a wide empty gap between two sparse columns. */
const pitchMixDistributionGridClass = (
  compact: boolean,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false
) =>
  compact
    ? coachPad
      ? coachPadExpanded
        ? "grid grid-cols-3 content-start gap-x-1.5 gap-y-1.5 sm:gap-x-2 sm:gap-y-2"
        : coachPadDense
          ? "grid grid-cols-3 gap-x-1.5 gap-y-1 text-[10px] leading-tight"
          : "grid grid-cols-2 gap-x-2.5 gap-y-2 text-xs leading-tight sm:grid-cols-3 sm:gap-x-3 sm:text-sm lg:text-base lg:leading-snug"
      : "grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs leading-tight sm:gap-x-3 sm:text-sm"
    : "grid grid-cols-3 gap-x-3 gap-y-2 text-base leading-tight";

function PitchMixDistributionBlock({
  dist,
  compact,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  coachPadFullGame = false,
  onPitchTypeClick,
}: {
  dist: PitchTypeDistributionResult;
  compact: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  coachPadFullGame?: boolean;
  /** When set, the type chips become tap targets (e.g. coach pad per-pitch-type modal). */
  onPitchTypeClick?: (type: PitchTrackerPitchType) => void;
}) {
  const stat = coachPadStatTypography(coachPadExpanded);
  /** Mix lists up to 7 types — values one step smaller than Rates/Contact on coach pad. */
  const valClass =
    coachPad && coachPadExpanded
      ? `tabular-nums font-bold leading-none ${PITCH_MIX_STAT_VAL} text-sm md:text-base`
      : stat.val;
  if (dist.typedTotal <= 0 || dist.entries.length === 0) {
    return (
      <p
        className={`leading-snug text-white ${
          coachPadExpanded
            ? "text-sm leading-snug md:text-base"
            : compact
              ? coachPad
                ? "text-xs md:text-sm"
                : "text-xs"
              : "text-sm"
        }`}
      >
        No typed pitches in log yet
      </p>
    );
  }
  const tiles = coachPadTileScale(coachPadExpanded, coachPadFullGame);
  if (tiles) {
    const chipClass =
      tiles === "lg"
        ? "h-6 w-9 text-[11px] md:h-7 md:w-10 md:text-xs"
        : "h-6 w-9 text-[11px]";
    const pctClass =
      tiles === "lg"
        ? "text-lg md:text-xl lg:text-2xl"
        : "text-base md:text-lg lg:text-xl";
    const countClass = tiles === "lg" ? "text-xs md:text-sm" : "text-[11px] md:text-xs";
    return (
      <div
        className="grid grid-cols-2 content-start gap-x-2 gap-y-2 md:gap-x-2.5 md:gap-y-2.5"
        role="group"
        aria-label="Pitch type mix among logged pitches with a type"
      >
        {dist.entries.map((e) => {
          const chip = onPitchTypeClick ? (
            <button
              type="button"
              onClick={() => onPitchTypeClick(e.type)}
              aria-label={`${pitchTrackerTypeLabel(e.type)} stats`}
              className={`touch-manipulation inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border font-bold transition hover:brightness-110 hover:shadow-[0_0_0.6rem_rgba(255,255,255,0.45)] active:scale-95 ${chipClass} ${pitchTrackerTypeChipClass(e.type)}`}
            >
              {pitchTrackerAbbrev(e.type)}
            </button>
          ) : (
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-md border font-bold ${chipClass} ${pitchTrackerTypeChipClass(e.type)}`}
            >
              {pitchTrackerAbbrev(e.type)}
            </span>
          );
          return (
            <span
              key={e.type}
              className="inline-flex min-w-0 max-w-full items-center gap-x-1.5 leading-none md:gap-x-2"
              title={`${pitchTrackerAbbrev(e.type)} — ${pitchTrackerTypeLabel(e.type)}`}
            >
              {chip}
              <span className={`tabular-nums font-bold leading-none ${PITCH_MIX_STAT_VAL} ${pctClass}`}>
                {formatPct(e.pct)}
              </span>
              <span className={`tabular-nums font-semibold leading-none text-white ${countClass}`}>
                ({e.count})
              </span>
            </span>
          );
        })}
      </div>
    );
  }
  /* Same chip + value look as the coach pitch pad Mix cards, at the table-card scale. */
  return (
    <div
      className={pitchMixDistributionGridClass(compact, coachPad, coachPadDense, coachPadExpanded)}
      role="group"
      aria-label="Pitch type mix among logged pitches with a type"
    >
      {dist.entries.map((e) => {
        const mixTitle = `${pitchTrackerAbbrev(e.type)} — ${pitchTrackerTypeLabel(e.type)}`;
        const chip = onPitchTypeClick ? (
          <button
            type="button"
            onClick={() => onPitchTypeClick(e.type)}
            aria-label={`${pitchTrackerTypeLabel(e.type)} stats`}
            className={`touch-manipulation inline-flex h-5 w-8 shrink-0 cursor-pointer items-center justify-center rounded border text-[10px] font-bold transition hover:brightness-110 hover:shadow-[0_0_0.45rem_rgba(255,255,255,0.35)] active:scale-95 ${pitchTrackerTypeChipClass(e.type)}`}
          >
            {pitchTrackerAbbrev(e.type)}
          </button>
        ) : (
          <span
            className={`inline-flex h-5 w-8 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${pitchTrackerTypeChipClass(e.type)}`}
          >
            {pitchTrackerAbbrev(e.type)}
          </span>
        );
        return (
          <span
            key={e.type}
            className="inline-flex min-w-0 max-w-full items-center gap-x-1.5 leading-none"
            title={mixTitle}
          >
            {chip}
            <span className={`whitespace-nowrap ${valClass}`}>
              {formatPct(e.pct)}{" "}
              <span className="font-medium text-white">({e.count})</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function PitchPlatoonMixBlock({
  vsLHB,
  vsRHB,
  compact,
}: {
  vsLHB: PitchTypeDistributionResult;
  vsRHB: PitchTypeDistributionResult;
  compact?: boolean;
}) {
  if (vsLHB.typedTotal <= 0 && vsRHB.typedTotal <= 0) return null;
  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border)]/40 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Mix vs LHB / RHB
      </p>
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-[10px] font-medium text-white">vs LHB</p>
          <PitchMixDistributionBlock dist={vsLHB} compact={compact ?? false} />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-white">vs RHB</p>
          <PitchMixDistributionBlock dist={vsRHB} compact={compact ?? false} />
        </div>
      </div>
      <p className="text-[9px] text-[var(--text-faint)]">L and R batters only; switch hitters excluded.</p>
    </div>
  );
}

function PitchMixExtrasBlock({
  agg,
  compact,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  coachPadFullGame = false,
}: {
  agg: PitchMixExtrasAgg | undefined;
  compact: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  coachPadFullGame?: boolean;
}) {
  const eff = agg ?? EMPTY_EXTRAS;
  const tiles = coachPadTileScale(coachPadExpanded, coachPadFullGame);
  const stat = coachPadStatTypography(coachPadExpanded, tiles);
  const valClass = stat.val;
  const missingClass = stat.missing;

  const pl = eff.pitchesLogged;
  const bip = eff.bipTyped;

  const swingPct = pl > 0 ? eff.swings / pl : null;
  const whiffPct = eff.swings > 0 ? eff.whiffs / eff.swings : null;
  const foulPct = pl > 0 ? eff.fouls / pl : null;
  const gbPct = bip > 0 ? eff.gb / bip : null;
  const ldPct = bip > 0 ? eff.ld / bip : null;
  const fbPct = bip > 0 ? eff.fb / bip : null;
  const iffPct = bip > 0 ? eff.iff / bip : null;

  const cell = (label: string, title: string, value: ReactNode) =>
    coachPadStatWrap(coachPadExpanded, label, title, compact, value, false, tiles);

  const emptyCell = coachPadExpanded ? null : <span className="min-h-[1em]" aria-hidden />;

  const swingSw = cell("Sw%:", "Swings ÷ pitches logged", <span className={valClass}>{formatPct(swingPct)}</span>);
  const swingWhiff = cell(
    "Whiff%:",
    "Swinging strikes ÷ swings",
    <span className={whiffPct != null ? valClass : missingClass}>{formatPct(whiffPct)}</span>
  );
  const swingFoul = cell("Foul%:", "Fouls ÷ pitches logged", <span className={valClass}>{formatPct(foulPct)}</span>);

  const bipGb = cell("GB%:", "Ground balls ÷ tagged balls in play", <span className={valClass}>{formatPct(gbPct)}</span>);
  const bipLd = cell("LD%:", "Line drives ÷ tagged balls in play", <span className={valClass}>{formatPct(ldPct)}</span>);
  const bipFb = cell("FB%:", "Fly balls ÷ tagged balls in play", <span className={valClass}>{formatPct(fbPct)}</span>);
  const bipIff = cell("IFF%:", "Infield flies ÷ tagged balls in play", <span className={valClass}>{formatPct(iffPct)}</span>);

  const fullGameContactGrid =
    "grid content-start gap-x-2 gap-y-2 md:gap-x-2.5 md:gap-y-2.5";

  if (tiles) {
    return (
      <div className="flex min-w-0 flex-col gap-2 md:gap-2.5" role="group" aria-label="Pitch log rates and batted ball mix">
        <div className={`${fullGameContactGrid} grid-cols-4`}>
          {bipGb}
          {bipLd}
          {bipFb}
          {bipIff}
        </div>
        <div className={`${fullGameContactGrid} grid-cols-3`}>
          {swingSw}
          {swingFoul}
          {swingWhiff}
        </div>
      </div>
    );
  }

  return (
    <div
      className={pitchMixMiniGridClass(compact, coachPad, coachPadDense, coachPadExpanded, coachPadFullGame)}
      role="group"
      aria-label="Pitch log rates and batted ball mix"
    >
      {bipGb}
      {swingSw}
      {bipLd}
      {swingFoul}
      {bipFb}
      {swingWhiff}
      {bipIff}
      {emptyCell}
    </div>
  );
}

function PitchMixMiniCard({
  title,
  compact,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  children,
}: {
  title: string;
  compact: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  children: ReactNode;
}) {
  const titleClass = compact
    ? coachPad
      ? coachPadExpanded
        ? "mb-0.5 font-display text-xs font-bold uppercase tracking-wider text-white md:text-sm"
        : coachPadDense
        ? "mb-0.5 font-display text-[8px] font-semibold uppercase tracking-wider text-white sm:text-[9px]"
        : "mb-1 font-display text-[9px] font-semibold uppercase tracking-wider text-white md:text-[11px]"
      : "mb-0.5 font-display text-[8px] font-semibold uppercase tracking-wider text-white"
    : "mb-1 font-display text-[9px] font-semibold uppercase tracking-wider text-white sm:text-[10px]";
  const shellClass =
    coachPad && coachPadExpanded
      ? "flex h-full min-h-0 min-w-0 flex-col break-inside-avoid rounded-lg border border-[var(--border)]/60 bg-[var(--bg-elevated)]/40 px-2 py-1 md:px-2 md:py-1"
      : coachPad && coachPadDense
        ? "flex min-w-0 flex-col break-inside-avoid rounded-md border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-1.5 py-1 sm:px-2 sm:py-1.5"
        : coachPad
          ? "flex min-w-0 flex-col break-inside-avoid rounded-md border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
          : "flex min-w-0 flex-col break-inside-avoid rounded-md border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-2 py-1.5 sm:px-2.5 sm:py-2";
  /** Coach pad tiles: `my-auto` centers when content fits; the wrapper scrolls (no clipped tiles) when squeezed. */
  if (coachPadExpanded) {
    return (
      <div className={shellClass}>
        <p className={titleClass}>{title}</p>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain touch-pan-y">
          <div className="my-auto min-w-0">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <p className={titleClass}>{title}</p>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function PitchMixRatesLine({
  mix,
  lob,
  compact,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  ariaLabel,
  extras,
  showLob,
  hidePitchesInRates = false,
  coachPadFullGame = false,
  onPitchesClick,
}: {
  mix: PitchMixLine;
  lob: number;
  compact: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  ariaLabel: string;
  extras?: PitchMixExtrasAgg;
  showLob: boolean;
  /** Coach full-game strip: pitches shown in the pitcher header instead. */
  hidePitchesInRates?: boolean;
  /** Coach full-game strip: 3-column Rates grid so P/PA stays visible. */
  coachPadFullGame?: boolean;
  /** Opens pitches-by-inning breakdown for this pitcher. */
  onPitchesClick?: () => void;
}) {
  const tiles = coachPadTileScale(coachPadExpanded, coachPadFullGame);
  const stat = coachPadStatTypography(coachPadExpanded, tiles);
  const valClass = stat.val;
  const missingClass = stat.missing;

  const pitchLog = extras != null && extras.pitchesLogged > 0;
  const emptyCell = coachPadExpanded ? null : <span className="min-h-[1em]" aria-hidden />;

  const fpsBlock = coachPadStatWrap(
    coachPadExpanded,
    "FPS:",
    "First pitch strikes",
    compact,
    <span
      className={`inline whitespace-nowrap ${mix.firstPitchOpportunities > 0 ? valClass : missingClass}`}
    >
      {mix.firstPitchOpportunities > 0
        ? `${mix.firstPitchStrikes}/${mix.firstPitchOpportunities}`
        : "—"}
      {mix.firstPitchStrikePct != null && mix.firstPitchOpportunities > 0 ? (
        <span className={stat.sub}> ({formatPct(mix.firstPitchStrikePct)})</span>
      ) : null}
    </span>,
    true,
    tiles
  );
  const strikePctBlock = coachPadStatWrap(
    coachPadExpanded,
    "Strike %:",
    "Strike percentage",
    compact,
    <span className={mix.strikePct != null ? valClass : missingClass}>{formatPct(mix.strikePct)}</span>,
    false,
    tiles
  );
  const ballsBlock = coachPadStatWrap(
    coachPadExpanded,
    "Balls:",
    "Balls thrown (pitch log)",
    compact,
    <span className={pitchLog ? valClass : missingClass}>{pitchLog ? extras!.balls : "—"}</span>,
    false,
    tiles
  );
  const strikesBlock = coachPadStatWrap(
    coachPadExpanded,
    "Strikes:",
    "Strikes thrown (pitch log; fouls and BIP count +1 each)",
    compact,
    <span className={pitchLog ? valClass : missingClass}>
      {pitchLog ? extras!.strikesThrown : "—"}
    </span>,
    false,
    tiles
  );
  const pitchesValue = (
    <span className={mix.plateAppearancesWithPitchCount > 0 ? valClass : missingClass}>
      {mix.plateAppearancesWithPitchCount > 0 ? mix.pitchesTotal : "—"}
    </span>
  );
  const pitchesBlock = onPitchesClick
    ? pitchMixClickableStat(
        onPitchesClick,
        "View pitches by inning",
        coachPadExpanded,
        "Pitches:",
        pitchesValue,
        tiles
      )
    : coachPadStatWrap(
        coachPadExpanded,
        "Pitches:",
        "Pitches thrown",
        compact,
        pitchesValue,
        false,
        tiles
      );
  const ppaBlock = coachPadStatWrap(
    coachPadExpanded,
    "P/PA:",
    "Pitches per plate appearance",
    compact,
    <span className={valClass}>{formatPpa(mix.pitchesPerPA)}</span>,
    false,
    tiles
  );
  const lobBlock = showLob
    ? coachPadStatWrap(
        coachPadExpanded,
        "LOB:",
        "Left on base",
        compact,
        <span className={valClass}>{lob}</span>
      )
    : null;

  return (
    <div
      className={pitchMixMiniGridClass(compact, coachPad, coachPadDense, coachPadExpanded, tiles !== false)}
      role="group"
      aria-label={ariaLabel}
    >
      {coachPadFullGame ? (
        <>
          {pitchesBlock}
          {strikesBlock}
          {ballsBlock}
          {fpsBlock}
          {strikePctBlock}
          {ppaBlock}
        </>
      ) : coachPadExpanded ? (
        <>
          {hidePitchesInRates ? emptyCell : pitchesBlock}
          {strikesBlock}
          {ballsBlock}
          {fpsBlock}
          {strikePctBlock}
          {ppaBlock}
        </>
      ) : (
        <>
          {hidePitchesInRates ? emptyCell : pitchesBlock}
          {strikesBlock}
          {ballsBlock}
          {fpsBlock}
          {strikePctBlock}
          {ppaBlock}
          {showLob ? (
            <>
              {lobBlock}
              {emptyCell}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function TwoStrikePitchMetricsRow({
  agg,
  compact,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  coachPadFullGame = false,
  perspective,
  embedded = false,
  onPitchesClick,
}: {
  agg: TwoStrikePitchAgg;
  compact: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  coachPadFullGame?: boolean;
  perspective: "batter" | "pitcher";
  /** Inside a titled mini card: no top border or duplicate “2 strikes” label. */
  embedded?: boolean;
  onPitchesClick?: () => void;
}) {
  const tiles = coachPadTileScale(coachPadExpanded, coachPadFullGame);
  const stat = coachPadStatTypography(coachPadExpanded, tiles);
  const valClass = stat.val;
  const missingClass = stat.missing;

  const p = agg.pitchesAtTwoStrikes;
  const swingPct = p > 0 ? agg.swingsAtTwoStrikes / p : null;
  const whiffPct =
    agg.swingsAtTwoStrikes > 0 ? agg.whiffsAtTwoStrikes / agg.swingsAtTwoStrikes : null;
  const foulPct = p > 0 ? agg.foulsAtTwoStrikes / p : null;

  const countLabel = "Pitches:";
  const countTitle =
    perspective === "pitcher"
      ? "Pitches this pitcher threw with the batter already at 2 strikes"
      : "Pitches in the log with 2 strikes on the batter";

  const aria =
    perspective === "pitcher"
      ? "Pitcher: pitches at two-strike counts"
      : "Batter: two-strike count behavior";

  const gridClass = pitchMixMiniGridClass(compact, coachPad, coachPadDense, coachPadExpanded);

  const inner = (
    <div className={gridClass} role="group" aria-label={aria}>
      {embedded ? null : (
        <span
          className="col-span-2 shrink-0 font-semibold uppercase tracking-wide text-white"
          title={
            perspective === "pitcher"
              ? "Rates on pitches thrown when the hitter already had 2 strikes"
              : "Rates on pitches when this batter already had 2 strikes"
          }
        >
          2 strikes
        </span>
      )}
      {onPitchesClick
        ? pitchMixClickableStat(
            onPitchesClick,
            "View pitches by inning",
            coachPadExpanded,
            countLabel,
            <span className={valClass}>{p}</span>,
            tiles
          )
        : coachPadStatWrap(
            coachPadExpanded,
            countLabel,
            countTitle,
            compact,
            <span className={valClass}>{p}</span>,
            false,
            tiles
          )}
      {coachPadStatWrap(
        coachPadExpanded,
        "Sw%:",
        "Swings ÷ pitches at 2 strikes",
        compact,
        <span className={swingPct != null ? valClass : missingClass}>{formatPct(swingPct)}</span>,
        false,
        tiles
      )}
      {coachPadStatWrap(
        coachPadExpanded,
        "Whiff%:",
        "Swinging strikes ÷ swings at 2 strikes",
        compact,
        <span className={whiffPct != null ? valClass : missingClass}>{formatPct(whiffPct)}</span>,
        false,
        tiles
      )}
      {coachPadStatWrap(
        coachPadExpanded,
        "Foul%:",
        "Fouls ÷ pitches at 2 strikes (spoiling / fighting pitches off)",
        compact,
        <span className={foulPct != null ? valClass : missingClass}>{formatPct(foulPct)}</span>,
        false,
        tiles
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="mt-2 border-t border-[var(--border)]/40 pt-2" role="presentation">
      {inner}
    </div>
  );
}

function PitchMixRow({
  name,
  mix,
  lob,
  extras,
  twoStrikeAgg,
  twoStrikePerspective,
  nameClass,
  compact,
  multi,
  variant = "pitcher",
  as: Tag = "li",
  showLob = true,
  showExtras = true,
  flush = false,
  omitName = false,
  layout = "grid",
  stripTypeDistribution = null,
  platoonMix = null,
  showPlatoonMix = false,
  showPitchLogEmptyNote = false,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  hidePitchesInRates = false,
  coachPadFullGame = false,
  onPitchTypeClick,
  onPitchesByInningClick,
  pitcherId,
  hideTypeMix = false,
}: {
  name: string;
  mix: PitchMixLine;
  lob: number;
  extras?: PitchMixExtrasAgg;
  /** When set and pitch log exists, third row: 2-strike pitch rates (batter or pitcher perspective). */
  twoStrikeAgg?: TwoStrikePitchAgg | null;
  nameClass: string;
  compact: boolean;
  coachPad?: boolean;
  /** Coach iPad: tighter mini-cards + 2×2 strip stack (Rates/2stk vs Contact/Mix). */
  coachPadDense?: boolean;
  /** Coach iPad matchup: fill panel height with larger readable stats in a 2×2 grid. */
  coachPadExpanded?: boolean;
  multi: boolean;
  variant?: "pitcher" | "team";
  /** Team totals render as `div` inside a styled footer; pitcher rows use `li`. */
  as?: "li" | "div";
  showLob?: boolean;
  showExtras?: boolean;
  /** Single row inside a card: no inner border; use `as="div"` on Record. */
  flush?: boolean;
  /** Hide the name line (e.g. when the parent renders name + game line above). */
  omitName?: boolean;
  /** `batter` for Current batter card; `pitcher` for mound pitch data. */
  twoStrikePerspective?: "batter" | "pitcher";
  /** `strip`: horizontal Rates / Contact / 2-strike band (e.g. coach pitch pad header). */
  layout?: "grid" | "strip";
  /** When set, adds a full-width “Mix” row below the grid or as the second row in strip layout. */
  stripTypeDistribution?: PitchTypeDistributionResult | null;
  platoonMix?: {
    vsLHB: PitchTypeDistributionResult;
    vsRHB: PitchTypeDistributionResult;
  } | null;
  showPlatoonMix?: boolean;
  showPitchLogEmptyNote?: boolean;
  hidePitchesInRates?: boolean;
  coachPadFullGame?: boolean;
  /** When set, Mix type chips open per-pitch-type stats (coach pad). */
  onPitchTypeClick?: (type: PitchTrackerPitchType) => void;
  /** When set with `pitcherId`, Pitches stats open a pitches-by-inning breakdown. */
  onPitchesByInningClick?: (pitcherId: string) => void;
  pitcherId?: string;
  /** Hide only the pitch-type Mix block (Rates / Contact / 2-strike stay). */
  hideTypeMix?: boolean;
}) {
  /** Keep name + stat mini-cards on one printed page (PDF / print dialog). */
  const breakKeepClass = "break-inside-avoid";
  const itemPad = flush
    ? "min-w-0"
    : multi
      ? "px-2 py-2 sm:px-3"
      : "rounded border border-[var(--border)]/50 bg-[var(--bg-elevated)]/25 px-3 py-2.5";
  const outerClass =
    Tag === "div"
      ? `min-w-0 ${
          coachPadExpanded ? "flex min-h-0 flex-1 flex-col" : ""
        } ${breakKeepClass}`
      : `${itemPad} ${breakKeepClass}`;

  const perspective = twoStrikePerspective ?? (showLob ? "pitcher" : "batter");

  const aggEff = extras ?? EMPTY_EXTRAS;
  const twoStrikeData = twoStrikeAgg ?? EMPTY_TWO_STRIKE_AGG;
  const ratesAria =
    variant === "team" ? "Team pitch data totals" : `Pitch mix for ${name}`;

  const stripWrap = (child: ReactNode) =>
    layout === "strip" ? (
      <div className={coachPad ? "min-w-0" : "min-w-0 flex-1 basis-[min(100%,11rem)] sm:basis-[10.5rem]"}>
        {child}
      </div>
    ) : (
      child
    );

  const gridClass = `pitch-mix-pdf-grid grid grid-cols-1 gap-2 lg:items-stretch ${
    coachPad ? "lg:gap-3" : ""
  } ${showExtras ? "lg:grid-cols-3" : "lg:grid-cols-2"}`;

  const stripTopRowClass = coachPadDense
    ? "grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:items-stretch"
    : coachPad
      ? "grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3"
      : "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch";

  const onPitchesClick =
    pitcherId && onPitchesByInningClick && showLob
      ? () => onPitchesByInningClick(pitcherId)
      : undefined;

  const padProps = { coachPad, coachPadDense, coachPadExpanded, coachPadFullGame };
  const ratesMini = (
    <PitchMixMiniCard title="Rates" compact={compact} {...padProps}>
      <PitchMixRatesLine
        mix={mix}
        lob={lob}
        compact={compact}
        {...padProps}
        ariaLabel={ratesAria}
        extras={extras}
        showLob={showLob}
        hidePitchesInRates={hidePitchesInRates}
        coachPadFullGame={coachPadFullGame}
        onPitchesClick={onPitchesClick}
      />
    </PitchMixMiniCard>
  );
  const contactMini = (
    <PitchMixMiniCard title="Contact" compact={compact} {...padProps}>
      <PitchMixExtrasBlock agg={aggEff} compact={compact} {...padProps} />
    </PitchMixMiniCard>
  );
  const twoStrikeMini = (
    <PitchMixMiniCard title="2 strikes" compact={compact} {...padProps}>
      <TwoStrikePitchMetricsRow
        agg={twoStrikeData}
        compact={compact}
        {...padProps}
        perspective={perspective}
        embedded
        onPitchesClick={onPitchesClick}
      />
    </PitchMixMiniCard>
  );
  const mixMini =
    !hideTypeMix && stripTypeDistribution != null ? (
      <PitchMixMiniCard title="Mix" compact={compact} {...padProps}>
        <PitchMixDistributionBlock
          dist={stripTypeDistribution}
          compact={compact}
          {...padProps}
          onPitchTypeClick={onPitchTypeClick}
        />
        {showPlatoonMix && platoonMix ? (
          <PitchPlatoonMixBlock
            vsLHB={platoonMix.vsLHB}
            vsRHB={platoonMix.vsRHB}
            compact={compact}
          />
        ) : null}
      </PitchMixMiniCard>
    ) : null;

  const pitchLogEmptyNote =
    showPitchLogEmptyNote && (extras?.pitchesLogged ?? 0) <= 0 ? (
      <p className="mb-2 text-xs leading-snug text-[var(--text-muted)]">
        No typed pitches in log — rates and mix need pitch data from Record.
      </p>
    ) : null;

  const expandedCell = (child: ReactNode) => (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{child}</div>
  );

  return (
    <Tag className={outerClass}>
      {pitchLogEmptyNote}
      {!omitName ? (
        <p className={`mb-1 ${nameClass}`} title={name}>
          {name}
        </p>
      ) : null}
      {layout === "strip" ? (
        <div
          className={
            coachPadExpanded
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-2"
              : `flex min-w-0 flex-col ${
                  coachPadDense ? "gap-1.5" : coachPad ? "gap-3 md:gap-3.5" : "gap-2"
                }`
          }
        >
          {coachPad && coachPadExpanded ? (
            <div className="grid h-full min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-x-2 sm:gap-y-2 md:gap-y-2 lg:gap-2">
              {expandedCell(ratesMini)}
              {showExtras ? expandedCell(contactMini) : null}
              {expandedCell(twoStrikeMini)}
              {mixMini != null ? expandedCell(mixMini) : null}
            </div>
          ) : coachPad && coachPadDense ? (
            <div className={stripTopRowClass}>
              <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
                {stripWrap(ratesMini)}
                {stripWrap(twoStrikeMini)}
              </div>
              <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
                {showExtras ? stripWrap(contactMini) : null}
                {mixMini != null ? stripWrap(mixMini) : null}
              </div>
            </div>
          ) : (
            <>
              <div className={stripTopRowClass}>
                {stripWrap(ratesMini)}
                {showExtras ? stripWrap(contactMini) : null}
                {stripWrap(twoStrikeMini)}
              </div>
              {mixMini != null ? (
                <div className="min-w-0 w-full">{stripWrap(mixMini)}</div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <>
          <div className={gridClass}>
            {stripWrap(ratesMini)}
            {showExtras ? stripWrap(contactMini) : null}
            {stripWrap(twoStrikeMini)}
          </div>
          {mixMini != null ? (
            <div className="mt-2 min-w-0 w-full">{mixMini}</div>
          ) : null}
        </>
      )}
    </Tag>
  );
}

/**
 * Horizontal Rates / Contact / 2-strike metrics for the current batter vs `currentPitcherId`
 * in `pas` (e.g. coach pitch pad header).
 */
export function MatchupPitchMixStrip({
  pas,
  pitchEvents = [],
  /** When set (e.g. coach pad), used only for the “Mix” block so typed pitches count before Record sets `result`. */
  distributionPitchEvents,
  currentPitcherId,
  compact = true,
  coachPad = false,
  coachPadDense = false,
  coachPadExpanded = false,
  hidePitchesInRates = false,
  hideLobInRates = false,
  coachPadFullGame = false,
  onPitchTypeClick,
}: {
  pas: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  distributionPitchEvents?: PitchEvent[];
  currentPitcherId: string | null;
  compact?: boolean;
  /** Coach iPad pitch pad: larger stat text on md+ while keeping compact layout. */
  coachPad?: boolean;
  /** Coach iPad: tighter mini-cards + 2×2 strip stack. */
  coachPadDense?: boolean;
  /** Coach iPad: oversized stat tiles filling available panel height. */
  coachPadExpanded?: boolean;
  hidePitchesInRates?: boolean;
  /** Coach full-game strip: LOB shown in the pitcher header instead. */
  hideLobInRates?: boolean;
  /** Coach full-game strip: 3-column Rates / Contact grids. */
  coachPadFullGame?: boolean;
  /** When set, Mix type chips open per-pitch-type stats (coach pad). */
  onPitchTypeClick?: (type: PitchTrackerPitchType) => void;
}) {
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const eventsByPaIdForDistribution = useMemo(
    () => groupPitchEventsByPaId(distributionPitchEvents ?? pitchEvents),
    [distributionPitchEvents, pitchEvents]
  );

  const row = useMemo(() => {
    if (typeof currentPitcherId !== "string" || currentPitcherId.length === 0) return null;
    const pitcherPas = pas.filter((p) => p.pitcher_id === currentPitcherId);
    const lobByPitcher = lobByPitcherFromPas(pas);
    const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
    const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
    const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
    const lob = lobByPitcher.get(currentPitcherId) ?? 0;
    const stripTypeDistribution = pitchTypeDistributionFromPitchLog(
      pitcherPas,
      eventsByPaIdForDistribution
    );
    return { mix, lob, extras, twoStrikeAgg, stripTypeDistribution };
  }, [currentPitcherId, pas, eventsByPaId, eventsByPaIdForDistribution]);

  if (!row) return null;

  const nameClass =
    `truncate font-display font-bold ${PITCH_MIX_NAME} ` + (compact ? "text-xs" : "text-sm");

  return (
    <PitchMixRow
      name="Matchup pitch data"
      mix={row.mix}
      lob={row.lob}
      extras={row.extras}
      twoStrikeAgg={row.twoStrikeAgg}
      twoStrikePerspective="pitcher"
      nameClass={nameClass}
      compact={compact}
      multi={false}
      as="div"
      flush
      omitName
      layout="strip"
      stripTypeDistribution={row.stripTypeDistribution}
      coachPad={coachPad}
      coachPadDense={coachPadDense}
      coachPadExpanded={coachPadExpanded}
      hidePitchesInRates={hidePitchesInRates}
      showLob={!hideLobInRates}
      coachPadFullGame={coachPadFullGame}
      onPitchTypeClick={onPitchTypeClick}
    />
  );
}

/** `pas`: plate appearances with this team on the mound (see `plateAppearancesForPitchingSide`). */
export function BattingPitchMixCard({
  pas,
  players,
  pitchEvents = [],
  distributionPitchEvents,
  compact = false,
  currentPitcherId = null,
  pitchPadLayout = false,
  inning,
  inningHalf,
  onPitchTypeClick,
  onPitchesByInningClick,
  onNameClick,
  hideTypeMix = false,
  batterBatsById: batterBatsByIdProp,
  pitcherCardsLayout = "compact",
  showPitchLogEmptyNote = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  /** Per-pitch log rows for these games’ PAs; enables Sw%, Whiff%, BIP mix, etc. */
  pitchEvents?: PitchEvent[];
  /** When set, used only for the “Mix” strip (coach iPad types before Record sets `result`). */
  distributionPitchEvents?: PitchEvent[];
  compact?: boolean;
  /**
   * When set (e.g. selected pitcher on Record PAs), the card shows only that pitcher’s pitch mix.
   * Use `PitchingPitchMixSupplement` below the pitching box table for other arms + team totals.
   */
  currentPitcherId?: string | null;
  /** Match pitch pad tracker block order (Rates → Contact → 2 strikes → Mix). */
  pitchPadLayout?: boolean;
  /** With `inningHalf`, shows “Pitches this inning” beside the pitcher name. */
  inning?: number;
  inningHalf?: "top" | "bottom";
  /** When set, Mix type chips open per-pitch-type stats for the current pitcher. */
  onPitchTypeClick?: (type: PitchTrackerPitchType) => void;
  /** When set, “Pitches this inning” and Rates Pitches open a pitches-by-inning breakdown. */
  onPitchesByInningClick?: (pitcherId: string) => void;
  /** When set, pitcher name opens matchup glance (Record). */
  onNameClick?: () => void;
  /** Hide only the pitch-type Mix block (Rates / Contact / 2-strike stay). */
  hideTypeMix?: boolean;
  batterBatsById?: Map<string, Bats | null | undefined>;
  pitcherCardsLayout?: "compact" | "expanded";
  showPitchLogEmptyNote?: boolean;
}) {
  const pad = pitchPadLayoutFlags(pitchPadLayout);
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const eventsByPaIdForDistribution = useMemo(
    () => groupPitchEventsByPaId(distributionPitchEvents ?? pitchEvents),
    [distributionPitchEvents, pitchEvents]
  );
  const batterBatsById = useMemo(
    () => batterBatsByIdProp ?? new Map(players.map((p) => [p.id, p.bats ?? null])),
    [batterBatsByIdProp, players]
  );

  const rows = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
      const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
      const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
      const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
      const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaIdForDistribution);
      const platoonMix = platoonPitchMixDistributions(pitcherPas, eventsByPaId, batterBatsById);
      const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
      const lob = lobByPitcher.get(pitcherId) ?? 0;
      return { pitcherId, name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution, platoonMix };
    });
  }, [pas, players, eventsByPaId, eventsByPaIdForDistribution, batterBatsById]);

  const teamMix = useMemo(
    () => pitchMixFromPlateAppearancesOrPitchLog(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamExtras = useMemo(
    () => aggregatePitchMixExtrasFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamTwoStrikeAgg = useMemo(
    () => aggregateTwoStrikePitchAggFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamLob = useMemo(() => {
    let s = 0;
    for (const v of lobByPitcherFromPas(pas).values()) s += v;
    return s;
  }, [pas]);
  const teamStripDistribution = useMemo(
    () => pitchTypeDistributionFromPitchLog(pas, eventsByPaIdForDistribution),
    [pas, eventsByPaIdForDistribution]
  );
  const teamPlatoonMix = useMemo(
    () => platoonPitchMixDistributions(pas, eventsByPaId, batterBatsById),
    [pas, eventsByPaId, batterBatsById]
  );

  const multi = rows.length > 1;
  const highlightCurrent =
    typeof currentPitcherId === "string" && currentPitcherId.length > 0;

  const primaryRow = useMemo(() => {
    if (!highlightCurrent) return null;
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    const pitcherPas = pas.filter((p) => p.pitcher_id === currentPitcherId);
    const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
    const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
    const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
    const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaIdForDistribution);
    const pitcher = byId.get(currentPitcherId);
    const name = pitcher?.name?.trim() || "Unknown";
    const jersey = pitcher?.jersey?.trim() || null;
    const lob = lobByPitcher.get(currentPitcherId) ?? 0;
    return {
      pitcherId: currentPitcherId,
      name,
      jersey,
      mix,
      lob,
      extras,
      twoStrikeAgg,
      stripTypeDistribution,
    };
  }, [highlightCurrent, currentPitcherId, pas, players, eventsByPaId, eventsByPaIdForDistribution]);

  const pitchesThisInning =
    highlightCurrent &&
    primaryRow &&
    typeof inning === "number" &&
    inningHalf != null &&
    currentPitcherId
      ? pitchesThisInningForPitcher(pas, pitchEvents, currentPitcherId, inning, inningHalf)
      : null;

  const nameClass = pitchDataCardNameClass(
    compact,
    pad.coachPad,
    false,
    pad.coachPadExpanded
  );

  const teamTotalsNameClass =
    "truncate font-display font-bold uppercase tracking-[0.12em] text-white " +
    (compact ? "text-[10px]" : "text-xs");

  const teamTotalsFooter = (
    <div
      className="break-inside-avoid border-t-2 border-[var(--accent)]/55 bg-[color-mix(in_srgb,var(--accent)_24%,var(--bg-elevated)/48)] px-2 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-3"
      role="group"
      aria-label="Team pitch data totals"
    >
      <PitchMixRow
        name="Team totals"
        mix={teamMix}
        lob={teamLob}
        extras={teamExtras}
        twoStrikeAgg={teamTwoStrikeAgg}
        nameClass={teamTotalsNameClass}
        compact={compact}
        multi
        variant="team"
        as="div"
        stripTypeDistribution={teamStripDistribution}
        platoonMix={teamPlatoonMix}
        showPlatoonMix
        showPitchLogEmptyNote={showPitchLogEmptyNote}
        hideTypeMix={hideTypeMix}
      />
    </div>
  );

  const pitcherRowProps = {
    nameClass,
    compact,
    hideTypeMix,
    showPlatoonMix: true,
    showPitchLogEmptyNote,
    multi: true as const,
    onPitchesByInningClick,
  };

  return (
    <div
      className={pitchDataPairCardShellClass(compact, pad.coachPad, false, pad.coachPadExpanded)}
      aria-label="Pitch data"
    >
      {!highlightCurrent && multi ? (
        <div className="mb-1 flex flex-wrap items-baseline justify-end gap-x-2">
          <span className="text-[9px] font-medium tabular-nums text-white">
            {rows.length} pitchers
          </span>
        </div>
      ) : null}

      {rows.length === 0 && !(highlightCurrent && primaryRow) ? (
        <p className="text-[10px] text-white">—</p>
      ) : highlightCurrent && primaryRow ? (
        <>
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            {onNameClick ? (
              <button
                type="button"
                onClick={onNameClick}
                className={`min-w-0 flex-1 cursor-pointer rounded text-left underline decoration-[var(--accent)]/40 decoration-2 underline-offset-4 transition hover:decoration-[var(--accent)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${nameClass}`}
                title="View matchup glance"
              >
                {primaryRow.name}
                {primaryRow.jersey ? (
                  <span className={`font-bold ${PITCH_MIX_NAME}`}> #{primaryRow.jersey}</span>
                ) : null}
              </button>
            ) : (
              <p
                className={`min-w-0 flex-1 ${nameClass}`}
                title={primaryRow.jersey ? `${primaryRow.name} #${primaryRow.jersey}` : primaryRow.name}
              >
                {primaryRow.name}
                {primaryRow.jersey ? (
                  <span className={`font-bold ${PITCH_MIX_NAME}`}> #{primaryRow.jersey}</span>
                ) : null}
              </p>
            )}
            {pitchesThisInning != null ? (
              onPitchesByInningClick ? (
                <button
                  type="button"
                  onClick={() => onPitchesByInningClick(primaryRow.pitcherId)}
                  className={`${pitchDataCardHeaderStatClass(compact)} shrink-0 cursor-pointer whitespace-nowrap rounded pr-6 text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 sm:pr-10 md:pr-14`}
                  title={`View pitches by inning — ${pitchesThisInning} in ${inningHalf === "bottom" ? "bottom" : "top"} ${inning}`}
                >
                  <span className="font-medium text-white">Pitches this inning: </span>
                  <span className={`font-bold tabular-nums ${PITCH_MIX_STAT_VAL}`}>
                    {pitchesThisInning}
                  </span>
                </button>
              ) : (
                <p
                  className={`${pitchDataCardHeaderStatClass(compact)} shrink-0 whitespace-nowrap pr-6 sm:pr-10 md:pr-14`}
                  title={`Pitches thrown by ${primaryRow.name} in ${inningHalf === "bottom" ? "bottom" : "top"} ${inning}`}
                >
                  <span className="font-medium text-white">Pitches this inning: </span>
                  <span className={`font-bold tabular-nums ${PITCH_MIX_STAT_VAL}`}>
                    {pitchesThisInning}
                  </span>
                </p>
              )
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <PitchMixRow
              key={primaryRow.pitcherId}
              name={primaryRow.name}
              mix={primaryRow.mix}
              lob={primaryRow.lob}
              extras={primaryRow.extras}
              twoStrikeAgg={primaryRow.twoStrikeAgg}
              nameClass={nameClass}
              compact={compact}
              multi={false}
              flush
              as="div"
              omitName
              pitcherId={primaryRow.pitcherId}
              layout={pitchPadLayout ? "strip" : "grid"}
              stripTypeDistribution={primaryRow.stripTypeDistribution}
              onPitchTypeClick={onPitchTypeClick}
              onPitchesByInningClick={onPitchesByInningClick}
              hideTypeMix={hideTypeMix}
              {...pad}
            />
          </div>
        </>
      ) : multi ? (
        pitcherCardsLayout === "expanded" ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.pitcherId}
                className="rounded border border-[var(--border)]/50 bg-[var(--bg-elevated)]/25 px-3 py-2.5"
              >
                <PitchMixRow
                  name={row.name}
                  mix={row.mix}
                  lob={row.lob}
                  extras={row.extras}
                  twoStrikeAgg={row.twoStrikeAgg}
                  stripTypeDistribution={row.stripTypeDistribution}
                  platoonMix={row.platoonMix}
                  pitcherId={row.pitcherId}
                  {...pitcherRowProps}
                  multi={false}
                  as="div"
                  flush
                />
              </div>
            ))}
            {teamTotalsFooter}
          </div>
        ) : (
        <div className="batting-pitch-mix-inner-scroll overflow-x-hidden rounded border border-[var(--border)]/60 bg-[var(--bg-elevated)]/30">
          <ul className="divide-y divide-[var(--border)]/50">
            {rows.map((row) => (
              <PitchMixRow
                key={row.pitcherId}
                name={row.name}
                mix={row.mix}
                lob={row.lob}
                extras={row.extras}
                twoStrikeAgg={row.twoStrikeAgg}
                stripTypeDistribution={row.stripTypeDistribution}
                platoonMix={row.platoonMix}
                pitcherId={row.pitcherId}
                {...pitcherRowProps}
              />
            ))}
          </ul>
          {teamTotalsFooter}
        </div>
        )
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <PitchMixRow
              key={row.pitcherId}
              name={row.name}
              mix={row.mix}
              lob={row.lob}
              extras={row.extras}
              twoStrikeAgg={row.twoStrikeAgg}
              stripTypeDistribution={row.stripTypeDistribution}
              platoonMix={row.platoonMix}
              pitcherId={row.pitcherId}
              {...pitcherRowProps}
              multi={false}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Every pitcher who has thrown in this sample (including the current selection) plus team totals —
 * for Record PAs, render below `GamePitchingBoxTable` while the top card shows only the selected pitcher.
 */
export function PitchingPitchMixSupplement({
  pas,
  players,
  pitchEvents = [],
  distributionPitchEvents,
  compact = false,
  currentPitcherId,
  hideTypeMix = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  pitchEvents?: PitchEvent[];
  distributionPitchEvents?: PitchEvent[];
  compact?: boolean;
  /** Used only to decide whether to render (Record passes selected pitcher). */
  currentPitcherId: string | null;
  /** Hide only the pitch-type Mix block (Rates / Contact / 2-strike stay). */
  hideTypeMix?: boolean;
}) {
  const highlight = typeof currentPitcherId === "string" && currentPitcherId.length > 0;
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const eventsByPaIdForDistribution = useMemo(
    () => groupPitchEventsByPaId(distributionPitchEvents ?? pitchEvents),
    [distributionPitchEvents, pitchEvents]
  );

  const rows = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
      const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
      const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
      const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
      const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaIdForDistribution);
      const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
      const lob = lobByPitcher.get(pitcherId) ?? 0;
      return { pitcherId, name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution };
    });
  }, [pas, players, eventsByPaId, eventsByPaIdForDistribution]);

  const teamMix = useMemo(
    () => pitchMixFromPlateAppearancesOrPitchLog(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamExtras = useMemo(
    () => aggregatePitchMixExtrasFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamTwoStrikeAgg = useMemo(
    () => aggregateTwoStrikePitchAggFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamLob = useMemo(() => {
    let s = 0;
    for (const v of lobByPitcherFromPas(pas).values()) s += v;
    return s;
  }, [pas]);
  const teamStripDistribution = useMemo(
    () => pitchTypeDistributionFromPitchLog(pas, eventsByPaIdForDistribution),
    [pas, eventsByPaId]
  );

  if (!highlight || pas.length === 0) return null;

  const titleClass = compact
    ? "font-display text-[9px] font-semibold uppercase tracking-wider text-white"
    : "font-display text-xs font-semibold uppercase tracking-wider text-white";

  const nameClass = pitchDataCardNameClass(compact);

  const teamTotalsNameClass =
    "truncate font-display font-bold uppercase tracking-[0.12em] text-white " +
    (compact ? "text-[10px]" : "text-xs");

  const teamTotalsFooter = (
    <div
      className="break-inside-avoid border-t-2 border-[var(--accent)]/55 bg-[color-mix(in_srgb,var(--accent)_24%,var(--bg-elevated)/48)] px-2 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-3"
      role="group"
      aria-label="Team pitch data totals"
    >
      <PitchMixRow
        name="Team totals"
        mix={teamMix}
        lob={teamLob}
        extras={teamExtras}
        twoStrikeAgg={teamTwoStrikeAgg}
        nameClass={teamTotalsNameClass}
        compact={compact}
        multi
        variant="team"
        as="div"
        stripTypeDistribution={teamStripDistribution}
        hideTypeMix={hideTypeMix}
      />
    </div>
  );

  return (
    <div className={pitchDataPairCardShellClass(compact)}>
      <div className={compact ? "mb-1" : "mb-2"}>
        <h3 className={titleClass}>Staff & totals</h3>
        {rows.length > 0 ? (
          <p
            className={`mt-0.5 ${compact ? "text-[9px]" : "text-[10px]"} font-medium uppercase tracking-wide text-white`}
          >
            All pitchers
          </p>
        ) : (
          <p
            className={`mt-0.5 ${compact ? "text-[9px]" : "text-[10px]"} text-white`}
          >
            Team pitch mix (all pitchers)
          </p>
        )}
      </div>
      <div className="batting-pitch-mix-inner-scroll overflow-x-hidden rounded border border-[var(--border)]/60 bg-[var(--bg-elevated)]/30">
        {rows.length > 0 ? (
          <ul className="divide-y divide-[var(--border)]/50">
            {rows.map((row) => (
              <PitchMixRow
                key={row.pitcherId}
                name={row.name}
                mix={row.mix}
                lob={row.lob}
                extras={row.extras}
                twoStrikeAgg={row.twoStrikeAgg}
                nameClass={nameClass}
                compact={compact}
                multi
                stripTypeDistribution={row.stripTypeDistribution}
                hideTypeMix={hideTypeMix}
              />
            ))}
          </ul>
        ) : null}
        {teamTotalsFooter}
      </div>
    </div>
  );
}

/**
 * Pitch-run rates for one batter’s PAs in the game (name should reflect the current batter selection).
 * Omits pitching LOB — that stat is mound-only.
 */
export function CurrentBatterPitchDataCard({
  batterName,
  pas,
  pitchEvents = [],
  /** When set (e.g. coach pad), used only for “Mix” so typed pitches count before Record sets `result`. */
  distributionPitchEvents,
  compact = false,
  coachPad = false,
  /** Coach iPad: tighter stat blocks + 2×2 strip stack inside pitch mix. */
  coachPadDense = false,
  coachPadExpanded = false,
  /** When true, only name + game line (e.g. coach pad shows pitch mix in page header). */
  omitPitchMixRow = false,
  /** Record: same stat order as pitch pad without other coach-pad chrome. */
  pitchPadLayout = false,
  onPitchTypeClick,
  onNameClick,
  hideTypeMix = false,
}: {
  batterName: string;
  pas: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  distributionPitchEvents?: PitchEvent[];
  compact?: boolean;
  coachPad?: boolean;
  coachPadDense?: boolean;
  coachPadExpanded?: boolean;
  omitPitchMixRow?: boolean;
  pitchPadLayout?: boolean;
  /** When set, Mix type chips open per-pitch-type stats (coach pad). */
  onPitchTypeClick?: (type: PitchTrackerPitchType) => void;
  /** When set, batter name opens matchup glance (Record). */
  onNameClick?: () => void;
  /** Hide only the pitch-type Mix block (Rates / Contact / 2-strike stay). */
  hideTypeMix?: boolean;
}) {
  const padFromRecord = pitchPadLayoutFlags(pitchPadLayout);
  const padCoach = coachPad || padFromRecord.coachPad;
  const padExpanded = coachPadExpanded || padFromRecord.coachPadExpanded;
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const eventsByPaIdForDistribution = useMemo(
    () => groupPitchEventsByPaId(distributionPitchEvents ?? pitchEvents),
    [distributionPitchEvents, pitchEvents]
  );
  const mix = useMemo(
    () => pitchMixFromPlateAppearancesOrPitchLog(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const extras = useMemo(
    () => aggregatePitchMixExtrasFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const twoStrikeAgg = useMemo(
    () => aggregateTwoStrikePitchAggFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const stripTypeDistribution = useMemo(
    () => pitchTypeDistributionFromPitchLog(pas, eventsByPaIdForDistribution),
    [pas, eventsByPaIdForDistribution]
  );
  /** Record PAs: unsaved / coach-live rows must not count toward H-AB / game line. */
  const pasForGameStatLine = useMemo(
    () =>
      pas.filter((p) => p.id !== "__draft_pitch_mix__" && p.id !== COACH_LIVE_AB_PA_ID),
    [pas]
  );
  const gameStatLine = useMemo(
    () => formatBatterGameStatLine(pasForGameStatLine),
    [pasForGameStatLine]
  );

  const nameClass = pitchDataCardNameClass(compact, padCoach, coachPadDense, padExpanded);

  return (
    <div
      className={pitchDataPairCardShellClass(compact, padCoach, coachPadDense, padExpanded)}
      aria-label="Batter pitch data"
    >
      <div
        className={`flex flex-wrap items-start gap-x-3 ${
          padExpanded ? "mb-1 shrink-0 gap-y-0.5 md:mb-1.5" : padCoach ? "mb-1.5 gap-y-1 md:mb-2" : "mb-1.5 gap-y-0.5"
        }`}
      >
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className={`min-w-0 flex-1 cursor-pointer rounded text-left underline decoration-[var(--accent)]/40 decoration-2 underline-offset-4 transition hover:decoration-[var(--accent)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${nameClass}`}
            title="View matchup glance"
          >
            {batterName}
          </button>
        ) : (
          <p className={`min-w-0 flex-1 ${nameClass}`} title={batterName}>
            {batterName}
          </p>
        )}
        <p
          className={pitchDataCardHeaderStatClass(compact, padCoach, coachPadDense, padExpanded)}
          title="This game — completed PAs: H-AB, results in order, RBI (current PA on the form is not included)"
        >
          {gameStatLine}
        </p>
      </div>
      {omitPitchMixRow ? null : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PitchMixRow
            name={batterName}
            mix={mix}
            lob={0}
            extras={extras}
            twoStrikeAgg={twoStrikeAgg}
            twoStrikePerspective="batter"
            nameClass={nameClass}
            compact={compact}
            coachPad={padCoach}
            coachPadDense={coachPadDense}
            coachPadExpanded={padExpanded}
            multi={false}
            showLob={false}
            flush
            as="div"
            omitName
            layout={padCoach ? "strip" : "grid"}
            stripTypeDistribution={stripTypeDistribution}
            onPitchTypeClick={onPitchTypeClick}
            hideTypeMix={hideTypeMix}
          />
        </div>
      )}
    </div>
  );
}

/** Single pitcher pitch mix card (game review stack, etc.). */
export function PitcherPitchDetailCard({
  pas,
  players,
  pitcherId,
  pitchEvents = [],
  batterBatsById: batterBatsByIdProp,
  onPitchesByInningClick,
  showPitchLogEmptyNote = false,
  compact = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  pitcherId: string;
  pitchEvents?: PitchEvent[];
  batterBatsById?: Map<string, Bats | null | undefined>;
  onPitchesByInningClick?: (pitcherId: string) => void;
  showPitchLogEmptyNote?: boolean;
  compact?: boolean;
}) {
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const batterBatsById = useMemo(
    () => batterBatsByIdProp ?? new Map(players.map((p) => [p.id, p.bats ?? null])),
    [batterBatsByIdProp, players]
  );

  const row = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
    const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
    const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
    const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
    const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaId);
    const platoonMix = platoonPitchMixDistributions(pitcherPas, eventsByPaId, batterBatsById);
    const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
    const lob = lobByPitcher.get(pitcherId) ?? 0;
    return { name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution, platoonMix };
  }, [pas, players, pitcherId, eventsByPaId, batterBatsById]);

  const nameClass = pitchDataCardNameClass(compact);

  return (
    <div className="rounded-lg border border-[var(--border)]/50 bg-[var(--bg-elevated)]/25 px-3 py-2.5">
      <PitchMixRow
        name={row.name}
        mix={row.mix}
        lob={row.lob}
        extras={row.extras}
        twoStrikeAgg={row.twoStrikeAgg}
        stripTypeDistribution={row.stripTypeDistribution}
        platoonMix={row.platoonMix}
        pitcherId={pitcherId}
        nameClass={nameClass}
        compact={compact}
        multi={false}
        as="div"
        flush
        showPlatoonMix
        showPitchLogEmptyNote={showPitchLogEmptyNote}
        onPitchesByInningClick={onPitchesByInningClick}
      />
    </div>
  );
}

/** Team pitching totals footer for game review pitcher stack. */
export function PitcherTeamPitchTotalsCard({
  pas,
  players,
  pitchEvents = [],
  batterBatsById: batterBatsByIdProp,
  showPitchLogEmptyNote = false,
  compact = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  pitchEvents?: PitchEvent[];
  batterBatsById?: Map<string, Bats | null | undefined>;
  showPitchLogEmptyNote?: boolean;
  compact?: boolean;
}) {
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const batterBatsById = useMemo(
    () => batterBatsByIdProp ?? new Map(players.map((p) => [p.id, p.bats ?? null])),
    [batterBatsByIdProp, players]
  );

  const teamMix = useMemo(
    () => pitchMixFromPlateAppearancesOrPitchLog(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamExtras = useMemo(
    () => aggregatePitchMixExtrasFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamTwoStrikeAgg = useMemo(
    () => aggregateTwoStrikePitchAggFromPas(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamLob = useMemo(() => {
    let s = 0;
    for (const v of lobByPitcherFromPas(pas).values()) s += v;
    return s;
  }, [pas]);
  const teamStripDistribution = useMemo(
    () => pitchTypeDistributionFromPitchLog(pas, eventsByPaId),
    [pas, eventsByPaId]
  );
  const teamPlatoonMix = useMemo(
    () => platoonPitchMixDistributions(pas, eventsByPaId, batterBatsById),
    [pas, eventsByPaId, batterBatsById]
  );

  const teamTotalsNameClass =
    "truncate font-display font-bold uppercase tracking-[0.12em] text-white " +
    (compact ? "text-[10px]" : "text-xs");

  return (
    <div
      className="break-inside-avoid border-t-2 border-[var(--accent)]/55 bg-[color-mix(in_srgb,var(--accent)_24%,var(--bg-elevated)/48)] px-2 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:px-3 sm:py-3"
      role="group"
      aria-label="Team pitch data totals"
    >
      <PitchMixRow
        name="Team totals"
        mix={teamMix}
        lob={teamLob}
        extras={teamExtras}
        twoStrikeAgg={teamTwoStrikeAgg}
        nameClass={teamTotalsNameClass}
        compact={compact}
        multi
        variant="team"
        as="div"
        stripTypeDistribution={teamStripDistribution}
        platoonMix={teamPlatoonMix}
        showPlatoonMix
        showPitchLogEmptyNote={showPitchLogEmptyNote}
      />
    </div>
  );
}
