"use client";

import { useMemo } from "react";
import {
  aggregatePitchMixExtrasFromPas,
  aggregateTwoStrikePitchAggFromPas,
  type PitchMixExtrasAgg,
  type TwoStrikePitchAgg,
} from "@/lib/compute/contactProfileFromPas";
import { pitchMixFromPlateAppearancesOrPitchLog } from "@/lib/compute/battingStats";
import {
  pitchTypeDistributionFromPitchLog,
  type PitchTypeDistributionResult,
} from "@/lib/compute/pitchTypeDistributionFromPitchLog";
import { formatBatterGameStatLine } from "@/lib/format/batterGameLine";
import { pitchTrackerAbbrev } from "@/lib/pitchTrackerUi";
import {
  batterBatsByIdFromPlayers,
  indexPasByPlayerId,
  platoonPitchMixDistributions,
} from "@/lib/compute/gamePasIndexes";
import type { Bats, PitchEvent, PitchTrackerPitchType, PlateAppearance, Player } from "@/lib/types";
import { computeGameBatting } from "@/components/analyst/GameBattingTable";
import { lobByPitcherFromPas } from "@/components/analyst/BattingPitchMixCard";

/** Raster PDF capture units: this many player blocks share one page when possible. */
const PDF_PLAYERS_PER_PAGE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return [items];
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
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

type PdfStatItem = { label: string; value: string };

const PDF_STAT_GRID_SLOTS = 9;

function PdfStat({ label, value }: PdfStatItem) {
  return (
    <div className="game-review-pdf-stat">
      <span className="game-review-pdf-stat-label">{label}</span>
      <span className="game-review-pdf-stat-value">{value}</span>
    </div>
  );
}

function PdfStatGrid3x3({ stats }: { stats: PdfStatItem[] }) {
  const cells: PdfStatItem[] = stats.slice(0, PDF_STAT_GRID_SLOTS);
  while (cells.length < PDF_STAT_GRID_SLOTS) {
    cells.push({ label: "", value: "" });
  }

  return (
    <div className="game-review-pdf-stat-panel-grid">
      {cells.map((stat, index) =>
        stat.label ? (
          <PdfStat key={`${stat.label}-${index}`} label={stat.label} value={stat.value} />
        ) : (
          <div key={`empty-${index}`} className="game-review-pdf-stat game-review-pdf-stat-empty" aria-hidden />
        )
      )}
    </div>
  );
}

function PdfStatPanel({ title, stats }: { title: string; stats: PdfStatItem[] }) {
  return (
    <div className="game-review-pdf-stat-panel">
      <h4 className="game-review-pdf-stat-panel-title">{title}</h4>
      <PdfStatGrid3x3 stats={stats} />
    </div>
  );
}

function PdfMixRow({ dist }: { dist: PitchTypeDistributionResult }) {
  if (dist.typedTotal <= 0 || dist.entries.length === 0) {
    return <p className="game-review-pdf-mix-empty">No typed pitches in log</p>;
  }
  return (
    <div className="game-review-pdf-mix-row">
      {dist.entries.map((e) => (
        <span key={e.type} className="game-review-pdf-mix-chip">
          <span className="game-review-pdf-mix-type">{pitchTrackerAbbrev(e.type as PitchTrackerPitchType)}</span>
          <span className="game-review-pdf-mix-pct">{formatPct(e.pct)}</span>
          <span className="game-review-pdf-mix-count">({e.count})</span>
        </span>
      ))}
    </div>
  );
}

function PdfPlatoonMixSection({
  vsLHB,
  vsRHB,
}: {
  vsLHB: PitchTypeDistributionResult;
  vsRHB: PitchTypeDistributionResult;
}) {
  if (vsLHB.typedTotal <= 0 && vsRHB.typedTotal <= 0) return null;

  return (
    <div className="game-review-pdf-platoon-mix">
      <h4 className="game-review-pdf-mix-title">Mix vs LHB / RHB</h4>
      <div className="game-review-pdf-platoon-mix-grid">
        <div className="game-review-pdf-platoon-mix-row">
          <p className="game-review-pdf-platoon-label">vs LHB</p>
          <PdfMixRow dist={vsLHB} />
        </div>
        <div className="game-review-pdf-platoon-mix-row">
          <p className="game-review-pdf-platoon-label">vs RHB</p>
          <PdfMixRow dist={vsRHB} />
        </div>
      </div>
      <p className="game-review-pdf-platoon-note">L and R batters only; switch hitters excluded.</p>
    </div>
  );
}

function PdfRatesPanel({
  mix,
  extras,
  showLob,
  lob,
}: {
  mix: ReturnType<typeof pitchMixFromPlateAppearancesOrPitchLog>;
  extras: PitchMixExtrasAgg;
  showLob?: boolean;
  lob?: number;
}) {
  const pitchLog = extras.pitchesLogged > 0;
  const stats: PdfStatItem[] = [
    {
      label: "Pitches",
      value: mix.plateAppearancesWithPitchCount > 0 ? String(mix.pitchesTotal) : "—",
    },
    { label: "P/PA", value: formatPpa(mix.pitchesPerPA) },
    {
      label: "FPS",
      value:
        mix.firstPitchOpportunities > 0
          ? `${mix.firstPitchStrikes}/${mix.firstPitchOpportunities}${
              mix.firstPitchStrikePct != null ? ` (${formatPct(mix.firstPitchStrikePct)})` : ""
            }`
          : "—",
    },
    { label: "Strike %", value: formatPct(mix.strikePct) },
  ];
  if (pitchLog) {
    stats.push({ label: "Balls", value: String(extras.balls) });
    stats.push({ label: "Strikes", value: String(extras.strikesThrown) });
  }
  if (showLob) {
    stats.push({ label: "LOB", value: String(lob ?? 0) });
  }

  return <PdfStatPanel title="Rates" stats={stats} />;
}

function PdfContactPanel({ extras }: { extras: PitchMixExtrasAgg }) {
  const pl = extras.pitchesLogged;
  const bip = extras.bipTyped;
  const swingPct = pl > 0 ? extras.swings / pl : null;
  const whiffPct = extras.swings > 0 ? extras.whiffs / extras.swings : null;
  const foulPct = pl > 0 ? extras.fouls / pl : null;
  const gbPct = bip > 0 ? extras.gb / bip : null;
  const ldPct = bip > 0 ? extras.ld / bip : null;
  const fbPct = bip > 0 ? extras.fb / bip : null;
  const iffPct = bip > 0 ? extras.iff / bip : null;

  const stats: PdfStatItem[] = [
    { label: "Sw%", value: formatPct(swingPct) },
    { label: "Whiff%", value: formatPct(whiffPct) },
    { label: "Foul%", value: formatPct(foulPct) },
    { label: "GB%", value: formatPct(gbPct) },
    { label: "LD%", value: formatPct(ldPct) },
    { label: "FB%", value: formatPct(fbPct) },
    { label: "IFF%", value: formatPct(iffPct) },
  ];

  return <PdfStatPanel title="Contact" stats={stats} />;
}

function PdfTwoStrikePanel({
  agg,
  perspective,
}: {
  agg: TwoStrikePitchAgg;
  perspective: "batter" | "pitcher";
}) {
  const p = agg.pitchesAtTwoStrikes;
  const swingPct = p > 0 ? agg.swingsAtTwoStrikes / p : null;
  const whiffPct = agg.swingsAtTwoStrikes > 0 ? agg.whiffsAtTwoStrikes / agg.swingsAtTwoStrikes : null;
  const foulPct = p > 0 ? agg.foulsAtTwoStrikes / p : null;
  const countLabel = perspective === "pitcher" ? "Thrown" : "Seen";

  const stats: PdfStatItem[] = [
    { label: countLabel, value: p > 0 ? String(p) : "—" },
    { label: "Sw%", value: formatPct(swingPct) },
    { label: "Whiff%", value: formatPct(whiffPct) },
    { label: "Foul%", value: formatPct(foulPct) },
  ];

  return <PdfStatPanel title="2 strikes" stats={stats} />;
}

function PdfPlayerPitchBlock({
  name,
  gameLine,
  mix,
  extras,
  twoStrikeAgg,
  dist,
  platoonMix,
  showLob,
  lob,
  twoStrikePerspective,
}: {
  name: string;
  gameLine?: string;
  mix: ReturnType<typeof pitchMixFromPlateAppearancesOrPitchLog>;
  extras: PitchMixExtrasAgg;
  twoStrikeAgg: TwoStrikePitchAgg;
  dist: PitchTypeDistributionResult;
  platoonMix?: { vsLHB: PitchTypeDistributionResult; vsRHB: PitchTypeDistributionResult };
  showLob?: boolean;
  lob?: number;
  twoStrikePerspective: "batter" | "pitcher";
}) {
  return (
    <article className="game-review-pdf-player-block" data-pdf-avoid-break>
      <header className="game-review-pdf-player-block-header">
        <h3 className="game-review-pdf-player-name">{name}</h3>
        {gameLine ? <p className="game-review-pdf-player-game-line">{gameLine}</p> : null}
      </header>
      <div className="game-review-pdf-player-panels">
        <PdfRatesPanel mix={mix} extras={extras} showLob={showLob} lob={lob} />
        <PdfContactPanel extras={extras} />
        <PdfTwoStrikePanel agg={twoStrikeAgg} perspective={twoStrikePerspective} />
      </div>
      <div className="game-review-pdf-player-mix">
        <h4 className="game-review-pdf-mix-title">Pitch mix</h4>
        <PdfMixRow dist={dist} />
      </div>
      {twoStrikePerspective === "pitcher" && platoonMix ? (
        <PdfPlatoonMixSection vsLHB={platoonMix.vsLHB} vsRHB={platoonMix.vsRHB} />
      ) : null}
    </article>
  );
}

export function GameReviewPdfTeamPitchTotals({
  pas,
  eventsByPaId,
  batterBatsById,
  teamName,
}: {
  pas: PlateAppearance[];
  eventsByPaId: Map<string, PitchEvent[]>;
  batterBatsById: Map<string, Bats | null | undefined>;
  teamName: string;
}) {
  const teamLob = useMemo(() => {
    let total = 0;
    for (const value of lobByPitcherFromPas(pas).values()) total += value;
    return total;
  }, [pas]);
  const platoonMix = useMemo(
    () => platoonPitchMixDistributions(pas, eventsByPaId, batterBatsById),
    [pas, eventsByPaId, batterBatsById]
  );

  if (pas.length === 0) return null;

  const mix = pitchMixFromPlateAppearancesOrPitchLog(pas, eventsByPaId);
  const extras = aggregatePitchMixExtrasFromPas(pas, eventsByPaId);
  const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(pas, eventsByPaId);
  const dist = pitchTypeDistributionFromPitchLog(pas, eventsByPaId);

  return (
    <div className="game-review-pdf-team-pitch-totals">
      <h3 className="game-review-pdf-team-totals-heading">Team pitch totals — {teamName}</h3>
      <PdfPlayerPitchBlock
        name="Team totals"
        mix={mix}
        extras={extras}
        twoStrikeAgg={twoStrikeAgg}
        dist={dist}
        platoonMix={platoonMix}
        showLob
        lob={teamLob}
        twoStrikePerspective="pitcher"
      />
    </div>
  );
}

function pinchHitterDisplayLabel(row: { name: string; position: string }): string {
  const pos = row.position?.trim();
  return pos ? `PH ${row.name} ${pos}` : `PH ${row.name}`;
}

export function GameReviewPdfBatterDetail({
  pas,
  players,
  eventsByPaId,
  pasByBatterId,
  lineupOrder,
  lineupPositionByPlayerId,
  baserunningByPlayerId,
  sectionTitle,
}: {
  pas: PlateAppearance[];
  players: Player[];
  eventsByPaId: Map<string, PitchEvent[]>;
  pasByBatterId: Map<string, PlateAppearance[]>;
  lineupOrder?: string[];
  lineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  sectionTitle: string;
}) {
  const rows = useMemo(
    () =>
      computeGameBatting(
        pas,
        players,
        lineupOrder,
        lineupPositionByPlayerId,
        baserunningByPlayerId
      ),
    [pas, players, lineupOrder, lineupPositionByPlayerId, baserunningByPlayerId]
  );

  if (rows.length === 0) return null;

  const pageGroups = chunk(rows, PDF_PLAYERS_PER_PAGE);

  return (
    <>
      {pageGroups.map((group, groupIndex) => (
        <div
          key={`batter-page-${groupIndex}`}
          data-pdf-subsection
          className="game-review-pdf-subsection-unit game-review-pdf-player-page-group"
        >
          {groupIndex === 0 ? (
            <h2 className="game-review-pdf-section-title">{sectionTitle}</h2>
          ) : null}
          {group.map((row, indexInGroup) => {
            const globalIndex = groupIndex * PDF_PLAYERS_PER_PAGE + indexInGroup;
            const starterLabel = row.position
              ? `${row.lineupSlot ?? globalIndex + 1}. ${row.name} ${row.position}`
              : `${row.lineupSlot ?? globalIndex + 1}. ${row.name}`;
            const nameLabel = row.isSubstitution ? pinchHitterDisplayLabel(row) : starterLabel;
            const batterPas = pasByBatterId.get(row.playerId) ?? [];
            const mix = pitchMixFromPlateAppearancesOrPitchLog(batterPas, eventsByPaId);
            const extras = aggregatePitchMixExtrasFromPas(batterPas, eventsByPaId);
            const twoStrikeAgg = aggregateTwoStrikePitchAggFromPas(batterPas, eventsByPaId);
            const dist = pitchTypeDistributionFromPitchLog(batterPas, eventsByPaId);
            const gameLine = formatBatterGameStatLine(batterPas);

            return (
              <PdfPlayerPitchBlock
                key={row.playerId}
                name={nameLabel}
                gameLine={gameLine}
                mix={mix}
                extras={extras}
                twoStrikeAgg={twoStrikeAgg}
                dist={dist}
                twoStrikePerspective="batter"
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

export function GameReviewPdfPitcherDetail({
  pas,
  players,
  eventsByPaId,
  pasByPitcherId,
  batterBatsById,
  sectionTitle,
}: {
  pas: PlateAppearance[];
  players: Player[];
  eventsByPaId: Map<string, PitchEvent[]>;
  pasByPitcherId: Map<string, PlateAppearance[]>;
  batterBatsById: Map<string, Bats | null | undefined>;
  sectionTitle: string;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const pitcherRows = useMemo(() => {
    const lobByPitcher = lobByPitcherFromPas(pas);
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pasByPitcherId.get(pitcherId) ?? [];
      return {
        pitcherId,
        name: byId.get(pitcherId)?.name?.trim() || "Unknown",
        mix: pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId),
        extras: aggregatePitchMixExtrasFromPas(pitcherPas, eventsByPaId),
        twoStrikeAgg: aggregateTwoStrikePitchAggFromPas(pitcherPas, eventsByPaId),
        dist: pitchTypeDistributionFromPitchLog(pitcherPas, eventsByPaId),
        platoonMix: platoonPitchMixDistributions(pitcherPas, eventsByPaId, batterBatsById),
        lob: lobByPitcher.get(pitcherId) ?? 0,
      };
    });
  }, [pas, byId, eventsByPaId, pasByPitcherId, batterBatsById]);

  if (pitcherRows.length === 0) return null;

  const pageGroups = chunk(pitcherRows, PDF_PLAYERS_PER_PAGE);

  return (
    <>
      {pageGroups.map((group, groupIndex) => (
        <div
          key={`pitcher-page-${groupIndex}`}
          data-pdf-subsection
          className="game-review-pdf-subsection-unit game-review-pdf-player-page-group"
        >
          {groupIndex === 0 ? (
            <h2 className="game-review-pdf-section-title">{sectionTitle}</h2>
          ) : null}
          {group.map((row) => (
            <PdfPlayerPitchBlock
              key={row.pitcherId}
              name={row.name}
              mix={row.mix}
              extras={row.extras}
              twoStrikeAgg={row.twoStrikeAgg}
              dist={row.dist}
              platoonMix={row.platoonMix}
              showLob
              lob={row.lob}
              twoStrikePerspective="pitcher"
            />
          ))}
        </div>
      ))}
    </>
  );
}
