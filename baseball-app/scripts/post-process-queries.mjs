import fs from "fs";
import path from "path";

const q = path.resolve("src/lib/db/queries");

const headers = {
  "pitchTracker.ts": `import { getSupabase } from "./client";\n`,
  "baserunning.ts": `import { getSupabase } from "./client";
import { isDemoId } from "../mockData";
import { BASERUNNING_EVENT_COLUMNS } from "./columns";
import type { BaserunningEvent, BaserunningEventInsert } from "@/lib/types";
`,
  "games.ts": `import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { Game, LineupSide } from "@/lib/types";
import { GAME_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { insertGameLineup, getSavedLineupWithSlots } from "./lineups";
import { getPlayers } from "./players";
`,
  "opponents.ts": `import { getSupabase } from "./client";
`,
  "types.ts": ``,
  "players.ts": `import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { kPctToKRate, type PlayerStatsForWatch } from "@/lib/playersToWatch";
import { getPlayerPrimaryPosition } from "@/lib/playerRoster";
import { isClubRosterPlayer, isPitcherPlayer, opponentNameKey } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { Game, Player, PlayerDeletionPreview } from "@/lib/types";
import { PLAYER_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getBattingStatsForPlayers } from "./stats/batting";
`,
  "lineups.ts": `import { isDemoId } from "../mockData";
import type { GameLineupSlot, LineupSide, SavedLineup, SavedLineupWithSlots } from "@/lib/types";
import { getSupabase } from "./client";
`,
  "plateAppearances.ts": `import { isDemoId } from "../mockData";
import type { PlateAppearance, PitchEventDraft } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { deleteAllBaserunningEvents, deleteBaserunningEventsByGame } from "./baserunning";
import { insertPitchEventsForPa } from "./pitchEvents";
`,
  "pitchEvents.ts": `import { clampPitchCountBefore } from "@/lib/compute/pitchSequence";
import { isDemoId } from "../mockData";
import type { PitchEvent, PitchEventDraft, PitchTrackerPitch } from "@/lib/types";
import { PITCH_EVENT_COLUMNS, PITCH_TRACKER_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getPlateAppearancesByGame } from "./plateAppearances";
`,
  "charts.ts": `import { isSprayChartBipResult } from "@/lib/sprayChartFilters";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { PlateAppearance } from "@/lib/types";
import { getSupabase } from "./client";
import { getPlayers } from "./players";
`,
  "defensive.ts": `import { isDemoId } from "../mockData";
import type { DefensiveEvent } from "@/lib/types";
import { DEFENSIVE_EVENT_COLUMNS } from "./columns";
import { getSupabase } from "./client";
`,
  "ratings.ts": `import type { PlayerRating } from "@/lib/types";
import { PLAYER_RATING_COLUMNS } from "./columns";
import { getSupabase } from "./client";
`,
  "matchup.ts": `import { gamesReferencedByPas } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { ClubBattingMatchupPayload, ClubPitchingMatchupPayload, Game, PlateAppearance } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getBaserunningTotalsForPlayerIds } from "./baserunning";
import { getGamesByIds } from "./games";
import { getPitchEventsForPaIds } from "./pitchEvents";
`,
  "stats/batting.ts": `import {
  battingStatsFromPAs,
  isBasesEmpty,
  isBasesLoaded,
  isRisp,
  isRunnersOn,
} from "@/lib/compute/battingStats";
import {
  buildBattingRunnerSituationSplit,
  buildStatsByFinalCountForSplits,
  mergeBaserunningIntoBattingStats,
  distinctGameCount,
  gamesStartedInSplit,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import { groupPitchEventsByPaId, mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import { isDemoId } from "../../mockData";
import type { BattingStats, BattingStatsWithSplits, PlateAppearance } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "../columns";
import { getSupabase, fetchFieldingErrorCountsForPlayers } from "../client";
import { getBaserunningTotalsForPlayerIds } from "../baserunning";
import { getPitchEventsForPaIds } from "../pitchEvents";
`,
  "stats/pitching.ts": `import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import {
  buildPitchingRunnerSituationsForPitcher,
  buildPitchingStatsByFinalCountForSplits,
  inheritedRunnersBequeathedTeamTotal,
  inheritedRunnersScoredInPasList,
  pitchingStatsFromPAs,
  platoonPitchingPasSplits,
} from "@/lib/compute/pitchingStats";
import { isGameFinalized } from "@/lib/gameRecord";
import { isDemoId } from "../../mockData";
import type { Bats, Game, PitchingRateLine, PitchingStats, PitchingStatsWithSplits, PitchingRunnerSituationSplit, PlateAppearance } from "@/lib/types";
import { GAME_COLUMNS, PLATE_APPEARANCE_COLUMNS } from "../columns";
import { getSupabase, fetchFieldingErrorCountsForPlayers } from "../client";
import { getPitchEventsForPaIds } from "../pitchEvents";
import { getPlateAppearancesByGame } from "../plateAppearances";
import type { PitcherOfficialTotals } from "../types";
`,
  "batch.ts": `import { isDemoId } from "../mockData";
import type { PitchEvent, PlateAppearance } from "@/lib/types";
import { getPitchEventsForPaIds } from "./pitchEvents";
import { getPlateAppearancesByBatters, getPlateAppearancesByPitchers } from "./plateAppearances";
`,
};

for (const [file, header] of Object.entries(headers)) {
  if (file === "batch.ts") continue;
  const p = path.join(q, file);
  if (!fs.existsSync(p)) continue;
  let body = fs.readFileSync(p, "utf8").replace(/^\/\/ AUTO-SPLIT[\s\S]*?\n\n/, "");
  if (file === "plateAppearances.ts") {
    // Remove duplicate supabaseDeletePaById at end
    const idx = body.lastIndexOf("async function supabaseDeletePaById");
    const first = body.indexOf("async function supabaseDeletePaById");
    if (idx !== first && idx > 0) {
      body = body.slice(0, idx).trimEnd() + "\n";
    }
  }
  fs.writeFileSync(p, header + body);
}

// games.ts: insert getGamesByIds after getGamesForCoachDashboard
const gamesPath = path.join(q, "games.ts");
let games = fs.readFileSync(gamesPath, "utf8");
if (!games.includes("getGamesByIds")) {
  games = games.replace(
    `export async function getGame(id: string)`,
    `/** Fetch only the games referenced by id (avoids loading full games table). */
export async function getGamesByIds(ids: string[]): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase || ids.length === 0) return [];
  const clean = [...new Set(ids.filter((id) => !isDemoId(id)))];
  if (clean.length === 0) return [];
  const { data } = await supabase.from("games").select(GAME_COLUMNS).in("id", clean);
  return (data ?? []) as Game[];
}

export async function getGame(id: string)`
  );
  // Reorder helpers before insertGame
  const helpers = games.match(/\/\*\* Omit from writes[\s\S]*?function stripLegacyOptionalGameColumns[\s\S]*?\n\}/)?.[0];
  if (helpers) {
    games = games.replace(helpers, "").replace(
      `export async function insertGame`,
      helpers + "\n\nexport async function insertGame"
    );
  }
  fs.writeFileSync(gamesPath, games);
}

// plateAppearances: add getPlateAppearancesByPitchers
const paPath = path.join(q, "plateAppearances.ts");
let pa = fs.readFileSync(paPath, "utf8");
if (!pa.includes("getPlateAppearancesByPitchers")) {
  pa = pa.replace(
    `export async function insertPlateAppearance(`,
    `/** Batch fetch PAs where any of the given pitchers were on the mound. */
export async function getPlateAppearancesByPitchers(pitcherIds: string[]): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || pitcherIds.length === 0) return [];
  const ids = pitcherIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("pitcher_id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

export async function insertPlateAppearance(`
  );
  fs.writeFileSync(paPath, pa);
}

// matchup.ts N+1 fix
let matchup = fs.readFileSync(path.join(q, "matchup.ts"), "utf8");
matchup = matchup.replace(
  `  const [paResult, gamesRes, brTotals, lineupRes] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("batter_id", cleanIds),
    supabase.from("games").select(GAME_COLUMNS).order("date", { ascending: false }),
    getBaserunningTotalsForPlayerIds(playerIds),
    supabase.from("game_lineups").select("game_id, player_id").in("player_id", cleanIds),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => !isDemoId(p.batter_id));
  const games = (gamesRes.data ?? []) as Game[];`,
  `  const [paResult, brTotals, lineupRes] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("batter_id", cleanIds),
    getBaserunningTotalsForPlayerIds(playerIds),
    supabase.from("game_lineups").select("game_id, player_id").in("player_id", cleanIds),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => !isDemoId(p.batter_id));
  const gameIds = [...new Set(pas.map((p) => p.game_id).filter(Boolean))] as string[];
  const games = await getGamesByIds(gameIds);`
);
matchup = matchup.replace(
  `  const [paResult, gamesRes, homeStarters, awayStarters] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("pitcher_id", clean),
    supabase.from("games").select(GAME_COLUMNS).order("date", { ascending: false }),
    supabase.from("games").select("id, starting_pitcher_home_id").in("starting_pitcher_home_id", clean),
    supabase.from("games").select("id, starting_pitcher_away_id").in("starting_pitcher_away_id", clean),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => p.pitcher_id && !isDemoId(p.pitcher_id));
  const games = (gamesRes.data ?? []) as Game[];`,
  `  const [paResult, homeStarters, awayStarters] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("pitcher_id", clean),
    supabase.from("games").select("id, starting_pitcher_home_id").in("starting_pitcher_home_id", clean),
    supabase.from("games").select("id, starting_pitcher_away_id").in("starting_pitcher_away_id", clean),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => p.pitcher_id && !isDemoId(p.pitcher_id));
  const gameIds = [...new Set(pas.map((p) => p.game_id).filter(Boolean))] as string[];
  const games = await getGamesByIds(gameIds);`
);
fs.writeFileSync(path.join(q, "matchup.ts"), matchup);

// batch.ts
if (!fs.existsSync(path.join(q, "batch.ts"))) {
  fs.writeFileSync(
    path.join(q, "batch.ts"),
    headers["batch.ts"] +
      `export type HitterReportSprayData = {
  pasByBatter: Record<string, PlateAppearance[]>;
  pasByPitcher: Record<string, PlateAppearance[]>;
  pitchEventsByBatter: Record<string, PitchEvent[]>;
};

/** Batched PA + pitch-event loads for multi-player hitter PDF reports (replaces per-player N+1). */
export async function getHitterReportSprayData(playerIds: string[]): Promise<HitterReportSprayData> {
  const ids = [...new Set(playerIds.filter((id) => id && !isDemoId(id)))];
  const empty = (): HitterReportSprayData => ({
    pasByBatter: {},
    pasByPitcher: {},
    pitchEventsByBatter: {},
  });
  if (ids.length === 0) return empty();

  const [pasAsBatter, pasAsPitcher] = await Promise.all([
    getPlateAppearancesByBatters(ids),
    getPlateAppearancesByPitchers(ids),
  ]);

  const pasByBatter: Record<string, PlateAppearance[]> = {};
  const pasByPitcher: Record<string, PlateAppearance[]> = {};
  for (const id of ids) {
    pasByBatter[id] = [];
    pasByPitcher[id] = [];
  }
  for (const pa of pasAsBatter) {
    if (pasByBatter[pa.batter_id]) pasByBatter[pa.batter_id].push(pa);
  }
  for (const pa of pasAsPitcher) {
    if (pa.pitcher_id && pasByPitcher[pa.pitcher_id]) pasByPitcher[pa.pitcher_id].push(pa);
  }

  const allBatterPaIds = pasAsBatter.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = allBatterPaIds.length > 0 ? await getPitchEventsForPaIds(allBatterPaIds) : [];
  const pitchEventsByBatter: Record<string, PitchEvent[]> = {};
  for (const id of ids) pitchEventsByBatter[id] = [];
  for (const pe of pitchEvents) {
    const pa = pasAsBatter.find((p) => p.id === pe.pa_id);
    if (pa && pitchEventsByBatter[pa.batter_id]) pitchEventsByBatter[pa.batter_id].push(pe);
  }

  return { pasByBatter, pasByPitcher, pitchEventsByBatter };
}
`
  );
}

// index.ts barrel
const exports = [
  "pitchTracker.ts",
  "baserunning.ts",
  "games.ts",
  "matchup.ts",
  "opponents.ts",
  "types.ts",
  "players.ts",
  "lineups.ts",
  "plateAppearances.ts",
  "pitchEvents.ts",
  "charts.ts",
  "defensive.ts",
  "ratings.ts",
  "stats/batting.ts",
  "stats/pitching.ts",
  "batch.ts",
];
const barrel = `/**
 * Data access layer — domain modules re-exported for backward compatibility.
 * @module @/lib/db/queries
 */

export * from "./pitchTracker";
export * from "./baserunning";
export * from "./games";
export * from "./matchup";
export * from "./opponents";
export * from "./types";
export * from "./players";
export * from "./lineups";
export * from "./plateAppearances";
export * from "./pitchEvents";
export * from "./charts";
export * from "./defensive";
export * from "./ratings";
export * from "./stats/batting";
export * from "./stats/pitching";
export * from "./batch";
`;
fs.writeFileSync(path.join(q, "index.ts"), barrel);
console.log("Post-process complete");
