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
import { pitchTrackerAbbrev, pitchTrackerTypeLabel } from "@/lib/pitchTrackerUi";
import type { PitchEvent, PlateAppearance, Player } from "@/lib/types";

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

function pitcherIdsInOrder(pas: PlateAppearance[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const pa of [...pas].sort(paChronological)) {
    if (!pa.pitcher_id || seen.has(pa.pitcher_id)) continue;
    seen.add(pa.pitcher_id);
    ids.push(pa.pitcher_id);
  }
  return ids;
}

/** Shared shell for the Record batter / pitcher pitch-data pair (equal padding, stretch in grid). */
function pitchDataPairCardShellClass(compact: boolean): string {
  const pad = compact ? "px-2 py-1.5" : "px-2.5 py-2";
  return `batting-pitch-mix-card-root rounded-lg border border-[var(--border)] bg-[var(--bg-card)] ${pad} flex h-full min-h-0 min-w-0 flex-col`;
}

function pitchDataCardNameClass(compact: boolean): string {
  return (
    "truncate font-display font-semibold text-[var(--accent)] " +
    (compact ? "text-sm sm:text-base" : "text-base sm:text-lg")
  );
}

function pitchDataCardHeaderStatClass(compact: boolean): string {
  return `min-w-0 flex-1 text-right font-semibold tabular-nums leading-tight text-[var(--text)] ${
    compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
  }`;
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

function lobByPitcherFromPas(pas: PlateAppearance[]): Map<string, number> {
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

const EMPTY_TWO_STRIKE_AGG: TwoStrikePitchAgg = {
  pitchesAtTwoStrikes: 0,
  swingsAtTwoStrikes: 0,
  whiffsAtTwoStrikes: 0,
  foulsAtTwoStrikes: 0,
};

const pitchMixMiniGridClass = (compact: boolean) =>
  compact
    ? "grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-tight sm:text-sm"
    : "grid grid-cols-2 gap-x-4 gap-y-2 text-base leading-tight";

/** Pitch-type mix strip: three columns to avoid a wide empty gap between two sparse columns. */
const pitchMixDistributionGridClass = (compact: boolean) =>
  compact
    ? "grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs leading-tight sm:gap-x-3 sm:text-sm"
    : "grid grid-cols-3 gap-x-3 gap-y-2 text-base leading-tight";

function PitchMixDistributionBlock({
  dist,
  compact,
}: {
  dist: PitchTypeDistributionResult;
  compact: boolean;
}) {
  const valClass = "tabular-nums font-semibold text-[var(--accent)]";
  if (dist.typedTotal <= 0 || dist.entries.length === 0) {
    return (
      <p
        className={`leading-snug text-[var(--text-muted)] ${compact ? "text-xs" : "text-sm"}`}
      >
        No typed pitches in log yet
      </p>
    );
  }
  return (
    <div
      className={pitchMixDistributionGridClass(compact)}
      role="group"
      aria-label="Pitch type mix among logged pitches with a type"
    >
      {dist.entries.map((e) => {
        const full = pitchTrackerTypeLabel(e.type);
        return (
          <span
            key={e.type}
            className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1"
          >
            <span
              className="min-w-0 font-semibold text-white"
              title={`${pitchTrackerAbbrev(e.type)} — ${full}`}
            >
              {full}:
            </span>
            <span className={valClass}>
              {formatPct(e.pct)} ({e.count})
            </span>
          </span>
        );
      })}
    </div>
  );
}

function PitchMixExtrasBlock({
  agg,
  compact,
}: {
  agg: PitchMixExtrasAgg | undefined;
  compact: boolean;
}) {
  const eff = agg ?? EMPTY_EXTRAS;

  const lab = (label: string, full: string) => (
    <span className="shrink-0 font-semibold text-white" title={compact ? undefined : full}>
      {label}
    </span>
  );

  const valClass = "tabular-nums font-semibold text-[var(--accent)]";
  const missingClass = "tabular-nums font-medium text-[var(--text-muted)]";

  const pl = eff.pitchesLogged;
  const bip = eff.bipTyped;

  const swingPct = pl > 0 ? eff.swings / pl : null;
  const whiffPct = eff.swings > 0 ? eff.whiffs / eff.swings : null;
  const foulPct = pl > 0 ? eff.fouls / pl : null;
  const gbPct = bip > 0 ? eff.gb / bip : null;
  const ldPct = bip > 0 ? eff.ld / bip : null;
  const fbPct = bip > 0 ? eff.fb / bip : null;
  const iffPct = bip > 0 ? eff.iff / bip : null;

  const cell = (label: string, title: string, value: ReactNode) => (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab(label, title)}
      {value}
    </span>
  );

  const emptyCell = <span className="min-h-[1em]" aria-hidden />;

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

  return (
    <div
      className={pitchMixMiniGridClass(compact)}
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
  children,
}: {
  title: string;
  compact: boolean;
  children: ReactNode;
}) {
  const titleClass = compact
    ? "mb-0.5 font-display text-[8px] font-semibold uppercase tracking-wider text-white/75"
    : "mb-1 font-display text-[9px] font-semibold uppercase tracking-wider text-white/80 sm:text-[10px]";
  return (
    <div className="flex min-w-0 flex-col break-inside-avoid rounded-md border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-2 py-1.5 sm:px-2.5 sm:py-2">
      <p className={titleClass}>{title}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function PitchMixRatesLine({
  mix,
  lob,
  compact,
  ariaLabel,
  extras,
  showLob,
}: {
  mix: PitchMixLine;
  lob: number;
  compact: boolean;
  ariaLabel: string;
  extras?: PitchMixExtrasAgg;
  showLob: boolean;
}) {
  const lab = (label: string, full: string) => (
    <span className="shrink-0 font-semibold text-white" title={compact ? undefined : full}>
      {label}
    </span>
  );

  const valClass = "tabular-nums font-semibold text-[var(--accent)]";
  const missingClass = "tabular-nums font-medium text-[var(--text-muted)]";

  const pitchLog = extras != null && extras.pitchesLogged > 0;
  const emptyCell = <span className="min-h-[1em]" aria-hidden />;

  const fpsBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("FPS:", "First pitch strikes")}
      <span className={mix.firstPitchOpportunities > 0 ? valClass : missingClass}>
        {mix.firstPitchOpportunities > 0
          ? `${mix.firstPitchStrikes} / ${mix.firstPitchOpportunities}`
          : "—"}
        {mix.firstPitchStrikePct != null && mix.firstPitchOpportunities > 0 ? (
          <span className="text-[var(--accent)]/85">
            {" "}
            ({formatPct(mix.firstPitchStrikePct)})
          </span>
        ) : null}
      </span>
    </span>
  );
  const strikePctBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("Strike %:", "Strike percentage")}
      <span className={mix.strikePct != null ? valClass : missingClass}>{formatPct(mix.strikePct)}</span>
    </span>
  );
  const ballsBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("Balls:", "Balls thrown (pitch log)")}
      <span className={pitchLog ? valClass : missingClass}>
        {pitchLog ? extras!.balls : "—"}
      </span>
    </span>
  );
  const strikesBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("Strikes:", "Strikes thrown (pitch log; fouls and BIP count +1 each)")}
      <span className={pitchLog ? valClass : missingClass}>
        {pitchLog ? extras!.strikesThrown : "—"}
      </span>
    </span>
  );
  const pitchesBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("Pitches:", "Pitches thrown")}
      <span className={mix.plateAppearancesWithPitchCount > 0 ? valClass : missingClass}>
        {mix.plateAppearancesWithPitchCount > 0 ? mix.pitchesTotal : "—"}
      </span>
    </span>
  );
  const ppaBlock = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("P/PA:", "Pitches per plate appearance")}
      <span className={valClass}>{formatPpa(mix.pitchesPerPA)}</span>
    </span>
  );
  const lobBlock = showLob ? (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {lab("LOB:", "Left on base")}
      <span className={valClass}>{lob}</span>
    </span>
  ) : null;

  return (
    <div className={pitchMixMiniGridClass(compact)} role="group" aria-label={ariaLabel}>
      {fpsBlock}
      {strikePctBlock}
      {ballsBlock}
      {strikesBlock}
      {pitchesBlock}
      {ppaBlock}
      {showLob ? (
        <>
          {lobBlock}
          {emptyCell}
        </>
      ) : null}
    </div>
  );
}

function TwoStrikePitchMetricsRow({
  agg,
  compact,
  perspective,
  embedded = false,
}: {
  agg: TwoStrikePitchAgg;
  compact: boolean;
  perspective: "batter" | "pitcher";
  /** Inside a titled mini card: no top border or duplicate “2 strikes” label. */
  embedded?: boolean;
}) {
  const valClass = "tabular-nums font-semibold text-[var(--accent)]";
  const missingClass = "tabular-nums font-medium text-[var(--text-muted)]";

  const lab = (label: string, full: string) => (
    <span className="shrink-0 font-semibold text-white" title={full}>
      {label}
    </span>
  );

  const p = agg.pitchesAtTwoStrikes;
  const swingPct = p > 0 ? agg.swingsAtTwoStrikes / p : null;
  const whiffPct =
    agg.swingsAtTwoStrikes > 0 ? agg.whiffsAtTwoStrikes / agg.swingsAtTwoStrikes : null;
  const foulPct = p > 0 ? agg.foulsAtTwoStrikes / p : null;

  const countLabel = perspective === "pitcher" ? "Pitches thrown:" : "Pitches seen:";
  const countTitle =
    perspective === "pitcher"
      ? "Pitches this pitcher threw with the batter already at 2 strikes"
      : "Pitches in the log with 2 strikes on the batter";

  const aria =
    perspective === "pitcher"
      ? "Pitcher: pitches at two-strike counts"
      : "Batter: two-strike count behavior";

  const gridClass = pitchMixMiniGridClass(compact);

  const inner = (
    <div className={gridClass} role="group" aria-label={aria}>
      {embedded ? null : (
        <span
          className="col-span-2 shrink-0 font-semibold uppercase tracking-wide text-white/90"
          title={
            perspective === "pitcher"
              ? "Rates on pitches thrown when the hitter already had 2 strikes"
              : "Rates on pitches when this batter already had 2 strikes"
          }
        >
          2 strikes
        </span>
      )}
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
        {lab("Sw%:", "Swings ÷ pitches at 2 strikes")}
        <span className={swingPct != null ? valClass : missingClass}>{formatPct(swingPct)}</span>
      </span>
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
        {lab("Whiff%:", "Swinging strikes ÷ swings at 2 strikes")}
        <span className={whiffPct != null ? valClass : missingClass}>{formatPct(whiffPct)}</span>
      </span>
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
        {lab("Foul%:", "Fouls ÷ pitches at 2 strikes (spoiling / fighting pitches off)")}
        <span className={foulPct != null ? valClass : missingClass}>{formatPct(foulPct)}</span>
      </span>
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
        {lab(countLabel, countTitle)}
        <span className={valClass}>{p}</span>
      </span>
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
}: {
  name: string;
  mix: PitchMixLine;
  lob: number;
  extras?: PitchMixExtrasAgg;
  /** When set and pitch log exists, third row: 2-strike pitch rates (batter or pitcher perspective). */
  twoStrikeAgg?: TwoStrikePitchAgg | null;
  nameClass: string;
  compact: boolean;
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
}) {
  /** Keep name + stat mini-cards on one printed page (PDF / print dialog). */
  const breakKeepClass = "break-inside-avoid";
  const itemPad = flush
    ? "min-w-0"
    : multi
      ? "px-2 py-2 sm:px-3"
      : "rounded border border-[var(--border)]/50 bg-[var(--bg-elevated)]/25 px-3 py-2.5";
  const outerClass =
    Tag === "div" ? `min-w-0 ${breakKeepClass}` : `${itemPad} ${breakKeepClass}`;

  const perspective = twoStrikePerspective ?? (showLob ? "pitcher" : "batter");

  const aggEff = extras ?? EMPTY_EXTRAS;
  const twoStrikeData = twoStrikeAgg ?? EMPTY_TWO_STRIKE_AGG;
  const ratesAria =
    variant === "team" ? "Team pitch data totals" : `Pitch mix for ${name}`;

  const stripWrap = (child: ReactNode) =>
    layout === "strip" ? (
      <div className="min-w-0 flex-1 basis-[min(100%,11rem)] sm:basis-[10.5rem]">{child}</div>
    ) : (
      child
    );

  const gridClass = `pitch-mix-pdf-grid grid grid-cols-1 gap-2 lg:items-stretch ${
    showExtras ? "lg:grid-cols-3" : "lg:grid-cols-2"
  }`;

  const stripTopRowClass =
    "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch";

  const ratesMini = (
    <PitchMixMiniCard title="Rates" compact={compact}>
      <PitchMixRatesLine
        mix={mix}
        lob={lob}
        compact={compact}
        ariaLabel={ratesAria}
        extras={extras}
        showLob={showLob}
      />
    </PitchMixMiniCard>
  );
  const contactMini = (
    <PitchMixMiniCard title="Contact" compact={compact}>
      <PitchMixExtrasBlock agg={aggEff} compact={compact} />
    </PitchMixMiniCard>
  );
  const twoStrikeMini = (
    <PitchMixMiniCard title="2 strikes" compact={compact}>
      <TwoStrikePitchMetricsRow
        agg={twoStrikeData}
        compact={compact}
        perspective={perspective}
        embedded
      />
    </PitchMixMiniCard>
  );

  return (
    <Tag className={outerClass}>
      {!omitName ? (
        <p className={`mb-1 ${nameClass}`} title={name}>
          {name}
        </p>
      ) : null}
      {layout === "strip" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div className={stripTopRowClass}>
            {stripWrap(ratesMini)}
            {showExtras ? stripWrap(contactMini) : null}
            {stripWrap(twoStrikeMini)}
          </div>
          {stripTypeDistribution != null ? (
            <div className="min-w-0 w-full">
              <PitchMixMiniCard title="Mix" compact={compact}>
                <PitchMixDistributionBlock dist={stripTypeDistribution} compact={compact} />
              </PitchMixMiniCard>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className={gridClass}>
            {stripWrap(ratesMini)}
            {showExtras ? stripWrap(contactMini) : null}
            {stripWrap(twoStrikeMini)}
          </div>
          {stripTypeDistribution != null ? (
            <div className="mt-2 min-w-0 w-full">
              <PitchMixMiniCard title="Mix" compact={compact}>
                <PitchMixDistributionBlock dist={stripTypeDistribution} compact={compact} />
              </PitchMixMiniCard>
            </div>
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
}: {
  pas: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  distributionPitchEvents?: PitchEvent[];
  currentPitcherId: string | null;
  compact?: boolean;
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
    "truncate font-display font-semibold text-[var(--accent)] " + (compact ? "text-xs" : "text-sm");

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
    />
  );
}

/** `pas`: plate appearances with this team on the mound (see `plateAppearancesForPitchingSide`). */
export function BattingPitchMixCard({
  pas,
  players,
  pitchEvents = [],
  compact = false,
  currentPitcherId = null,
}: {
  pas: PlateAppearance[];
  players: Player[];
  /** Per-pitch log rows for these games’ PAs; enables Sw%, Whiff%, BIP mix, etc. */
  pitchEvents?: PitchEvent[];
  compact?: boolean;
  /**
   * When set (e.g. selected pitcher on Record PAs), the card shows only that pitcher’s pitch mix.
   * Use `PitchingPitchMixSupplement` below the pitching box table for other arms + team totals.
   */
  currentPitcherId?: string | null;
}) {
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);

  const rows = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
      const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
      const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
      const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
      const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaId);
      const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
      const lob = lobByPitcher.get(pitcherId) ?? 0;
      return { pitcherId, name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution };
    });
  }, [pas, players, eventsByPaId]);

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
    const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaId);
    const name = byId.get(currentPitcherId)?.name?.trim() || "Unknown";
    const lob = lobByPitcher.get(currentPitcherId) ?? 0;
    return { pitcherId: currentPitcherId, name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution };
  }, [highlightCurrent, currentPitcherId, pas, players, eventsByPaId]);

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
      />
    </div>
  );

  return (
    <div className={pitchDataPairCardShellClass(compact)} aria-label="Pitch data">
      {!highlightCurrent && multi ? (
        <div className="mb-1 flex flex-wrap items-baseline justify-end gap-x-2">
          <span className="text-[9px] font-medium tabular-nums text-[var(--text-muted)]">
            {rows.length} pitchers
          </span>
        </div>
      ) : null}

      {rows.length === 0 && !(highlightCurrent && primaryRow) ? (
        <p className="text-[10px] text-[var(--text-muted)]">—</p>
      ) : highlightCurrent && primaryRow ? (
        <>
          <div className="mb-1.5 flex flex-wrap items-start gap-x-3 gap-y-0.5">
            <p className={`min-w-0 flex-1 ${nameClass}`} title={primaryRow.name}>
              {primaryRow.name}
            </p>
            <p
              className={`${pitchDataCardHeaderStatClass(compact)} text-transparent`}
              aria-hidden
            >
              &nbsp;
            </p>
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
              stripTypeDistribution={primaryRow.stripTypeDistribution}
            />
          </div>
        </>
      ) : multi ? (
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
                nameClass={nameClass}
                compact={compact}
                multi
                stripTypeDistribution={row.stripTypeDistribution}
              />
            ))}
          </ul>
          {teamTotalsFooter}
        </div>
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
              nameClass={nameClass}
              compact={compact}
              multi={false}
              stripTypeDistribution={row.stripTypeDistribution}
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
  compact = false,
  currentPitcherId,
}: {
  pas: PlateAppearance[];
  players: Player[];
  pitchEvents?: PitchEvent[];
  compact?: boolean;
  /** Used only to decide whether to render (Record passes selected pitcher). */
  currentPitcherId: string | null;
}) {
  const highlight = typeof currentPitcherId === "string" && currentPitcherId.length > 0;
  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);

  const rows = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const lobByPitcher = lobByPitcherFromPas(pas);
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
      const mix = pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
      const extras = aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId);
      const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId);
      const stripTypeDistribution = pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaId);
      const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
      const lob = lobByPitcher.get(pitcherId) ?? 0;
      return { pitcherId, name, mix, lob, extras, twoStrikeAgg, stripTypeDistribution };
    });
  }, [pas, players, eventsByPaId]);

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
      />
    </div>
  );

  return (
    <div className={pitchDataPairCardShellClass(compact)}>
      <div className={compact ? "mb-1" : "mb-2"}>
        <h3 className={titleClass}>Staff & totals</h3>
        {rows.length > 0 ? (
          <p
            className={`mt-0.5 ${compact ? "text-[9px]" : "text-[10px]"} font-medium uppercase tracking-wide text-[var(--text-muted)]`}
          >
            All pitchers
          </p>
        ) : (
          <p
            className={`mt-0.5 ${compact ? "text-[9px]" : "text-[10px]"} text-[var(--text-muted)]`}
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
  /** When true, only name + game line (e.g. coach pad shows pitch mix in page header). */
  omitPitchMixRow = false,
}: {
  batterName: string;
  pas: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  distributionPitchEvents?: PitchEvent[];
  compact?: boolean;
  omitPitchMixRow?: boolean;
}) {
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

  const nameClass = pitchDataCardNameClass(compact);

  return (
    <div className={pitchDataPairCardShellClass(compact)} aria-label="Batter pitch data">
      <div className="mb-1.5 flex flex-wrap items-start gap-x-3 gap-y-0.5">
        <p className={`min-w-0 flex-1 ${nameClass}`} title={batterName}>
          {batterName}
        </p>
        <p
          className={pitchDataCardHeaderStatClass(compact)}
          title="This game — completed PAs: H-AB, results in order, RBI (current PA on the form is not included)"
        >
          {gameStatLine}
        </p>
      </div>
      {omitPitchMixRow ? null : (
        <div className="flex min-h-0 flex-1 flex-col">
          <PitchMixRow
            name={batterName}
            mix={mix}
            lob={0}
            extras={extras}
            twoStrikeAgg={twoStrikeAgg}
            twoStrikePerspective="batter"
            nameClass={nameClass}
            compact={compact}
            multi={false}
            showLob={false}
            flush
            as="div"
            omitName
            stripTypeDistribution={stripTypeDistribution}
          />
        </div>
      )}
    </div>
  );
}
