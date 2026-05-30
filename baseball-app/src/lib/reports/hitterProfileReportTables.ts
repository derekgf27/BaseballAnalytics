/**
 * Builds hitter profile table payloads for PDF export — mirrors analyst player profile sections.
 */

import {
  battingSheetDataColumns,
  battingSheetDataColumnsForCountStateDiscipline,
  battingSheetDataColumnsForProfileCompact,
  FINAL_COUNT_BUCKET_OPTIONS,
  formatProfileBattingSheetCell,
  type BattingSheetColumnMode,
  type ProfileBattingColumnDef,
} from "@/components/analyst/battingStatsSheetModel";
import { battingLineWithCountStateContact, buildBattingDisciplineLineAtCountState } from "@/lib/compute/statsSheetCountStateContact";
import {
  buildProfileRecentGameRows,
  PROFILE_RECENT_GAMES_COUNT,
  profileLineWithCountState,
  type ProfileBattingLine,
} from "@/lib/profileBattingDisplay";
import type {
  BattingStats,
  BattingStatsWithSplits,
  Game,
  PitchEvent,
  PlateAppearance,
  StatsRunnersFilterKey,
} from "@/lib/types";

export type HitterProfileReportSection = {
  title: string;
  subtitle?: string;
  /** When set, first column is the row label (Split, Count, etc.). */
  rowLabelHeader?: string;
  columnLabels: string[];
  rows: string[][];
};

export type HitterProfileReportPayload = {
  sections: HitterProfileReportSection[];
};

const PROFILE_SPLIT_ROWS = [
  { label: "vs LHP", key: "vsL" as const, runnersFilter: "all" as const },
  { label: "vs RHP", key: "vsR" as const, runnersFilter: "all" as const },
  { label: "RISP", key: "risp" as const, runnersFilter: "risp" as const },
];

const PROFILE_RUNNER_SITUATION_ROWS: {
  label: string;
  key: keyof NonNullable<BattingStatsWithSplits["runnerSituations"]>;
}[] = [
  { label: "Bases empty", key: "basesEmpty" },
  { label: "Runners on", key: "runnersOn" },
  { label: "RISP", key: "risp" },
  { label: "Bases loaded", key: "basesLoaded" },
];

type ColumnContext = "standard" | "profileCompact" | "countStateDiscipline";

function columnsFor(mode: BattingSheetColumnMode, context: ColumnContext): ProfileBattingColumnDef[] {
  if (context === "countStateDiscipline") return battingSheetDataColumnsForCountStateDiscipline();
  if (context === "profileCompact") return battingSheetDataColumnsForProfileCompact(mode);
  return battingSheetDataColumns(mode);
}

function cellsForLine(
  cols: ProfileBattingColumnDef[],
  line: ProfileBattingLine | undefined,
  baserunningSource: BattingStats | undefined
): string[] {
  return cols.map((col) =>
    formatProfileBattingSheetCell(col, line, baserunningSource, line?.countStatePitches)
  );
}

function labeledSection(
  title: string,
  rowLabelHeader: string,
  mode: BattingSheetColumnMode,
  context: ColumnContext,
  rows: { label: string; line?: ProfileBattingLine; hasSample?: boolean }[],
  baserunningSource: BattingStats | undefined
): HitterProfileReportSection {
  const cols = columnsFor(mode, context);
  const body = rows.map(({ label, line, hasSample = true }) => {
    if (!hasSample || !line) return [label, ...cols.map(() => "—")];
    return [label, ...cellsForLine(cols, line, baserunningSource)];
  });
  return {
    title,
    rowLabelHeader,
    columnLabels: cols.map((c) => c.label),
    rows: body,
  };
}

function seasonLineSection(
  line: BattingStats | undefined,
  baserunningSource: BattingStats | undefined
): HitterProfileReportSection {
  const cols = columnsFor("standard", "standard");
  return {
    title: "Season line",
    columnLabels: cols.map((c) => c.label),
    rows: line ? [cellsForLine(cols, line, baserunningSource)] : [cols.map(() => "—")],
  };
}

function recentGamesSection(
  playerId: string,
  pas: PlateAppearance[],
  games: Game[]
): HitterProfileReportSection | null {
  const gamesRows = buildProfileRecentGameRows(playerId, pas, games, PROFILE_RECENT_GAMES_COUNT);
  if (gamesRows.length === 0) return null;
  return {
    title: "Recent games",
    rowLabelHeader: "Date",
    columnLabels: ["Game", "Line"],
    rows: gamesRows.map((g) => [g.dateLabel, g.matchup, g.statLine]),
  };
}

export function buildHitterProfileReportPayload(
  playerId: string,
  battingSplits: BattingStatsWithSplits,
  battingPas: PlateAppearance[],
  battingPitchEvents: PitchEvent[],
  games: Game[]
): HitterProfileReportPayload {
  const overallBr = battingSplits.overall;
  const pas = battingPas;
  const events = battingPitchEvents;

  const lineWith = (
    line: BattingStats | null | undefined,
    mode: BattingSheetColumnMode,
    finalCount: Parameters<typeof profileLineWithCountState>[5],
    splitView: Parameters<typeof profileLineWithCountState>[6],
    runners: StatsRunnersFilterKey
  ) =>
    profileLineWithCountState(line, playerId, pas, events, mode, finalCount, splitView, runners);

  const seasonStandard = lineWith(overallBr, "standard", null, "overall", "all");

  const splitStandardRows = PROFILE_SPLIT_ROWS.map(({ label, key, runnersFilter }) => {
    const raw = battingSplits[key] ?? undefined;
    const splitView = key === "vsL" ? "vsL" : key === "vsR" ? "vsR" : "overall";
    return {
      label,
      line: lineWith(raw, "standard", null, splitView, runnersFilter),
      hasSample: raw != null,
    };
  });

  const disciplineSeason = lineWith(overallBr, "contact", null, "overall", "all");
  const disciplineSplitRows = PROFILE_SPLIT_ROWS.map(({ label, key, runnersFilter }) => {
    const raw = battingSplits[key] ?? undefined;
    const splitView = key === "vsL" ? "vsL" : key === "vsR" ? "vsR" : "overall";
    return {
      label,
      line: lineWith(raw, "contact", null, splitView, runnersFilter),
      hasSample: raw != null,
    };
  });

  const finalCountRows = FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
    const raw = battingSplits.statsByFinalCount?.overall?.[value] ?? undefined;
    return {
      label,
      line: raw ?? undefined,
      hasSample: raw != null && (raw.pa ?? 0) > 0,
    };
  });

  const runnerSituationRows =
    battingSplits.runnerSituations != null
      ? PROFILE_RUNNER_SITUATION_ROWS.map(({ label, key }) => {
          const raw = battingSplits.runnerSituations![key]?.combined ?? undefined;
          return {
            label,
            line: lineWith(raw, "standard", null, "overall", key),
            hasSample: raw != null,
          };
        })
      : [];

  const disciplineByCountRows = FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
    const line = buildBattingDisciplineLineAtCountState(playerId, pas, events, "overall", "all", value);
    return {
      label,
      line,
      hasSample: line != null && (line.pa ?? 0) > 0,
    };
  });

  const sections: HitterProfileReportSection[] = [];
  const recent = recentGamesSection(playerId, pas, games);
  if (recent) sections.push(recent);

  sections.push(
    seasonLineSection(seasonStandard, overallBr),
    labeledSection(
      "Batting splits",
      "Split",
      "standard",
      "profileCompact",
      splitStandardRows,
      overallBr
    )
  );

  if (runnerSituationRows.length > 0) {
    sections.push(
      labeledSection(
        "By base state",
        "Situation",
        "standard",
        "profileCompact",
        runnerSituationRows,
        overallBr
      )
    );
  }

  sections.push(
    labeledSection(
      "Discipline & BIP",
      "Line",
      "contact",
      "profileCompact",
      [{ label: "Season", line: disciplineSeason, hasSample: overallBr != null }, ...disciplineSplitRows],
      overallBr
    ),
    labeledSection(
      "By final count",
      "Count",
      "standard",
      "profileCompact",
      finalCountRows,
      overallBr
    ),
    labeledSection(
      "Discipline & BIP by count state",
      "Count",
      "contact",
      "countStateDiscipline",
      disciplineByCountRows,
      overallBr
    )
  );

  return { sections };
}
