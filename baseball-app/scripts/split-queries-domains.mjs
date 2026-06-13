/**
 * Splits queries/index.ts into domain modules. Run from baseball-app/: node scripts/split-queries-domains.mjs
 */
import fs from "fs";
import path from "path";

const queriesDir = path.resolve("src/lib/db/queries");
const src = fs.readFileSync(path.join(queriesDir, "index.ts"), "utf8");

const MODULE_MAP = {
  "pitchTracker.ts": ["linkPitchTrackerGroupToPlateAppearance"],
  "baserunning.ts": [
    "getBaserunningTotalsForPlayerIds",
    "getBaserunningTotalsForGame",
    "getBaserunningEventsForGame",
    "insertBaserunningEvent",
    "deleteBaserunningEvent",
    "deleteBaserunningEventsByGame",
    "deleteAllBaserunningEvents",
    "getBaserunningEventsForGames",
  ],
  "games.ts": [
    "getGames",
    "getGamesForCoachDashboard",
    "getGamesByIds",
    "getGame",
    "insertGame",
    "createGameWithLineup",
    "updateGame",
    "replaceGameLineup",
    "deleteGame",
  ],
  "matchup.ts": ["getClubBattingMatchupPayload", "getClubPitchingMatchupPayload"],
  "opponents.ts": [
    "getTrackedOpponents",
    "getTrackedOpponentNames",
    "insertTrackedOpponent",
    "updateTrackedOpponent",
    "deleteTrackedOpponent",
  ],
  "players.ts": [
    "getPlayers",
    "getPlayersByIds",
    "getPlayersForGame",
    "insertPlayer",
    "updatePlayer",
    "getPlayerDeletionPreview",
    "deletePlayer",
    "getPlayersToWatchInput",
  ],
  "lineups.ts": [
    "getGameLineup",
    "insertGameLineup",
    "getSavedLineups",
    "getSavedLineupWithSlots",
    "insertSavedLineup",
    "updateSavedLineup",
    "deleteSavedLineup",
    "getGameLineupsForGames",
  ],
  "plateAppearances.ts": [
    "getPlateAppearancesByGame",
    "getPlateAppearancesForGames",
    "getPlateAppearancesByBatter",
    "getPlateAppearancesByPitcher",
    "getPlateAppearancesByBatters",
    "getPlateAppearancesByPitchers",
    "insertPlateAppearance",
    "insertPlateAppearanceWithPitchLog",
    "deletePlateAppearance",
    "getPlateAppearanceById",
    "updatePlateAppearanceRow",
    "deletePlateAppearancesByGame",
    "deleteAllPlateAppearances",
  ],
  "charts.ts": [
    "getSprayChartRowsForGames",
    "getTeamPlateAppearancesForPitchingSpray",
    "getTeamPlateAppearancesForSpray",
    "getTeamPlateAppearancesForCharts",
    "getChartsPagePlateData",
  ],
  "defensive.ts": ["getDefensiveEventsByGame"],
  "ratings.ts": ["getPlayerRating", "getPlayerRatingsBatch", "upsertPlayerRating"],
  "pitchEvents.ts": [
    "getPitchEventsForPaIds",
    "getPitchEventsForGame",
    "getPitchTrackerPitchesForGame",
    "insertPitchEventsForPa",
  ],
  "stats/batting.ts": [
    "getBattingStatsForPlayers",
    "getTeamBattingStats",
    "getTeamBattingStatsRisp",
    "getBattingStatsWithSplitsForPlayers",
  ],
  "stats/pitching.ts": [
    "getPitcherOfficialTotalsForPlayers",
    "getPitchingStatsForPlayers",
    "getPitchingStatsForPitcherVsOurClub",
    "getPitcherLastOutingBefore",
    "getTeamPitchingStats",
  ],
  "batch.ts": ["getHitterReportSprayData"],
};

// Extract exports (functions, types, interfaces, const)
const exportRegex =
  /^(export (?:async )?function \w+|export interface \w+|export type \w+|const \w+ =)/gm;
const matches = [...src.matchAll(exportRegex)];
const blocks = new Map();

for (let i = 0; i < matches.length; i++) {
  const start = matches[i].index;
  const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
  const block = src.slice(start, end).trimEnd();
  const nameMatch = block.match(/^export (?:async )?function (\w+)|^export interface (\w+)|^export type (\w+)/);
  const name = nameMatch?.[1] ?? nameMatch?.[2] ?? nameMatch?.[3];
  if (name) blocks.set(name, block);
}

// Also extract non-export helpers at end of games.ts
const gameHelpersMatch = src.match(
  /\/\*\* Omit from writes[\s\S]*?function stripLegacyOptionalGameColumns[\s\S]*?\n\}/
);
const gameHelpers = gameHelpersMatch?.[0] ?? "";

const pitchConstMatch = src.match(
  /const EMPTY_RATE_LINE[\s\S]*?const EMPTY_PITCHING_STATS_WITH_SPLITS[\s\S]*?\}\);/
);
const pitchConstants = pitchConstMatch?.[0] ?? "";

const paChunkMatch = src.match(/const PITCH_EVENTS_PA_ID_CHUNK = \d+;/);
const paChunk = paChunkMatch?.[0] ?? "const PITCH_EVENTS_PA_ID_CHUNK = 200;";

const supabaseDeletePa = blocks.get("insertPlateAppearanceWithPitchLog")?.includes("supabaseDeletePaById")
  ? src.match(/async function supabaseDeletePaById[\s\S]*?\n\}/)?.[0]
  : src.match(/async function supabaseDeletePaById[\s\S]*?\n\}/)?.[0];

// Types block
const trackedOpponentType = blocks.get("getTrackedOpponents")
  ? src.match(/export interface TrackedOpponentRow[\s\S]*?\}/)?.[0]
  : "";
const pitcherOfficialType = src.match(/export type PitcherOfficialTotals[\s\S]*?\};/m)?.[0] ?? "";

const nameToFile = new Map();
for (const [file, names] of Object.entries(MODULE_MAP)) {
  for (const n of names) nameToFile.set(n, file);
}
nameToFile.set("TrackedOpponentRow", "types.ts");
nameToFile.set("PitcherOfficialTotals", "types.ts");

const fileContents = new Map();
const addToFile = (file, content) => {
  fileContents.set(file, (fileContents.get(file) ?? "") + content + "\n\n");
};

for (const [name, block] of blocks) {
  const file = nameToFile.get(name);
  if (file) addToFile(file, block);
}

if (trackedOpponentType) addToFile("types.ts", trackedOpponentType);
if (pitcherOfficialType) addToFile("types.ts", pitcherOfficialType);
if (gameHelpers) addToFile("games.ts", gameHelpers.replace(/^/, ""));
if (pitchConstants) addToFile("stats/pitching.ts", pitchConstants);
if (paChunk) addToFile("pitchEvents.ts", paChunk);
if (supabaseDeletePa) addToFile("plateAppearances.ts", supabaseDeletePa);

// Write files with header placeholder
for (const [file, body] of fileContents) {
  const outPath = path.join(queriesDir, file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `// AUTO-SPLIT — imports added by post-process\n\n${body}`);
  console.log("Wrote", file, body.split("\n").length, "lines");
}

console.log("Unassigned exports:", [...blocks.keys()].filter((n) => !nameToFile.has(n)));
