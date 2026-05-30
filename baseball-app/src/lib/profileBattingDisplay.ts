/**
 * Player profile batting tables: pitch-log coverage notes and count-state pitch counts.
 */

import { battingLineWithCountStateContact } from "@/lib/compute/statsSheetCountStateContact";
import type { BattingSheetColumnMode } from "@/components/analyst/battingStatsSheetModel";
import { formatBatterGameStatLine } from "@/lib/format/batterGameLine";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  Game,
  PitchEvent,
  PlateAppearance,
  StatsRunnersFilterKey,
} from "@/lib/types";

export type ProfileBattingLine = BattingStats & {
  /** Pitches at this count state (discipline-by-count table only). */
  countStatePitches?: number;
};

/** Recent games table on hitter profile (web + PDF). */
export const PROFILE_RECENT_GAMES_COUNT = 4;

export type ProfileRecentGameRow = {
  gameId: string;
  dateLabel: string;
  matchup: string;
  /** In-game line, e.g. `2-3, HR, BB, 2RBI`. */
  statLine: string;
};

/** Overlay count-state contact on a split line (profile + PDF). */
export function profileLineWithCountState(
  line: BattingStats | null | undefined,
  playerId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  battingColumnMode: BattingSheetColumnMode,
  finalCountBucket: BattingFinalCountBucketKey | null,
  splitView: "overall" | "vsL" | "vsR",
  runnersFilter: StatsRunnersFilterKey
): ProfileBattingLine | undefined {
  if (!line) return undefined;
  return battingLineWithCountStateContact(
    line,
    playerId,
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    finalCountBucket,
    battingColumnMode
  );
}

export function countPasWithPitchLog(
  playerId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined
): number {
  if (!pas?.length || !pitchEvents?.length) return 0;
  const paIds = new Set(pas.filter((pa) => pa.batter_id === playerId).map((pa) => pa.id));
  const withLog = new Set<string>();
  for (const e of pitchEvents) {
    if (paIds.has(e.pa_id)) withLog.add(e.pa_id);
  }
  return withLog.size;
}

export function profilePitchCoverageNote(
  seasonPa: number,
  pasWithPitchLog: number
): string | null {
  if (seasonPa <= 0 || pasWithPitchLog >= seasonPa) return null;
  return `Pitch log covers ${pasWithPitchLog} of ${seasonPa} plate appearances — discipline rates use recorded pitches only.`;
}

export function buildProfileRecentGameRows(
  playerId: string,
  pas: PlateAppearance[] | undefined,
  games: Game[],
  limit = PROFILE_RECENT_GAMES_COUNT
): ProfileRecentGameRow[] {
  const list = (pas ?? []).filter((pa) => pa.batter_id === playerId);
  if (list.length === 0) return [];

  const gameById = new Map(games.map((g) => [g.id, g]));
  const byGame = new Map<string, PlateAppearance[]>();
  for (const pa of list) {
    const bucket = byGame.get(pa.game_id) ?? [];
    bucket.push(pa);
    byGame.set(pa.game_id, bucket);
  }

  const rows = [...byGame.entries()].map(([gameId, gamePas]) => {
    const g = gameById.get(gameId);
    const dateRaw = g?.date ?? "";
    return {
      gameId,
      dateSort: dateRaw ? Date.parse(`${dateRaw}T12:00:00`) : 0,
      dateLabel: g?.date ? formatDateMMDDYYYY(g.date) : "—",
      matchup: g ? matchupLabelUsFirst(g, false) : "Unknown game",
      statLine: formatBatterGameStatLine(gamePas),
    };
  });

  rows.sort((a, b) => b.dateSort - a.dateSort);
  return rows.slice(0, limit).map(({ gameId, dateLabel, matchup, statLine }) => ({
    gameId,
    dateLabel,
    matchup,
    statLine,
  }));
}
