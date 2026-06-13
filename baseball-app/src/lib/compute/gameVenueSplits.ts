import { mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import {
  distinctGameCount,
  gamesStartedInSplit,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import { battingStatsFromPAs, fieldingErrorsByPlayerFromPas } from "@/lib/compute/battingStats";
import {
  buildPitchingStatsLine,
  countOfficialPitchDecisionsFromGames,
} from "@/lib/compute/pitchingStats";
import type {
  Bats,
  BattingStats,
  Game,
  PitchEvent,
  PitchingStats,
  PlateAppearance,
} from "@/lib/types";

export type GameVenueSide = "home" | "away";

export function gameOurSideByIdFromGames(
  games: Pick<Game, "id" | "our_side">[]
): Map<string, GameVenueSide> {
  return new Map(
    games
      .filter((g) => g.id && (g.our_side === "home" || g.our_side === "away"))
      .map((g) => [g.id, g.our_side])
  );
}

export function filterPasByOurVenue(
  pas: PlateAppearance[],
  venue: GameVenueSide,
  gameOurSideById: Map<string, GameVenueSide>
): PlateAppearance[] {
  return pas.filter((pa) => gameOurSideById.get(pa.game_id) === venue);
}

export function starterGameIdsForVenue(
  starterGameIds: Set<string>,
  venue: GameVenueSide,
  gameOurSideById: Map<string, GameVenueSide>
): Set<string> {
  return new Set([...starterGameIds].filter((gid) => gameOurSideById.get(gid) === venue));
}

export function countRunsForPlayerInPas(pasList: PlateAppearance[], playerId: string): number {
  return pasList.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.filter((id) => id === playerId).length ?? 0),
    0
  );
}

export function buildBattingStatsForVenue(
  pasList: PlateAppearance[],
  venue: GameVenueSide,
  gameOurSideById: Map<string, GameVenueSide>,
  playerId: string,
  startedGames: Set<string>,
  eventsByPaId: Map<string, PitchEvent[]>,
  fieldingE: number
): BattingStats | null {
  const sub = filterPasByOurVenue(pasList, venue, gameOurSideById);
  if (sub.length === 0) return null;
  const st = battingStatsFromPAs(sub);
  if (!st) return null;
  st.r = countRunsForPlayerInPas(sub, playerId);
  st.gp = distinctGameCount(sub);
  st.gs = gamesStartedInSplit(startedGames, sub);
  mergeContactProfileIntoBattingStats(st, sub, eventsByPaId);
  st.e = fieldingE;
  return st;
}

export function buildPitchingStatsForVenue(
  pasList: PlateAppearance[],
  venue: GameVenueSide,
  gameOurSideById: Map<string, GameVenueSide>,
  pitcherId: string,
  starterGameIds: Set<string>,
  _batterBatsById: Map<string, Bats | null | undefined>,
  eventsByPaId: Map<string, PitchEvent[]>,
  allPasForRunCharges: PlateAppearance[],
  gamesForOfficialDecisions?: Game[]
): PitchingStats | null {
  const sub = filterPasByOurVenue(pasList, venue, gameOurSideById);
  if (sub.length === 0) return null;
  const starters = starterGameIdsForVenue(starterGameIds, venue, gameOurSideById);
  const line =
    buildPitchingStatsLine(sub, starters, eventsByPaId, {
      pitcherId,
      allPas: allPasForRunCharges,
    }) ?? null;
  if (!line) return null;
  if (gamesForOfficialDecisions?.length) {
    const venueGames = gamesForOfficialDecisions.filter((g) => g.our_side === venue);
    const official = countOfficialPitchDecisionsFromGames(pitcherId, venueGames);
    line.w = official.wins;
    line.l = official.losses;
    line.sv = official.saves;
  }
  line.e = fieldingErrorsByPlayerFromPas(sub)[pitcherId] ?? 0;
  return line;
}

export function paMatchesOurVenueSplit(
  pa: PlateAppearance,
  split: GameVenueSide,
  gameOurSideById: Map<string, GameVenueSide>
): boolean {
  return gameOurSideById.get(pa.game_id) === split;
}
