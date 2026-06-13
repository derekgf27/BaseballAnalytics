import fs from "fs";
import path from "path";

const root = path.resolve("src/lib/db");
const srcPath = path.join(root, "queries.ts");
const outDir = path.join(root, "queries");
let src = fs.readFileSync(srcPath, "utf8");

const reps = [
  [/\.from\("games"\)\.select\("\*"\)/g, '.from("games").select(GAME_COLUMNS)'],
  [/\.from\("players"\)\.select\("\*"\)/g, '.from("players").select(PLAYER_COLUMNS)'],
  [/\.from\("plate_appearances"\)\.select\("\*"\)/g, '.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS)'],
  [/\.from\("baserunning_events"\)\.select\("\*"\)/g, '.from("baserunning_events").select(BASERUNNING_EVENT_COLUMNS)'],
  [/\.from\("pitch_events"\)\.select\("\*"\)/g, '.from("pitch_events").select(PITCH_EVENT_COLUMNS)'],
  [/\.from\("pitches"\)\.select\("\*"\)/g, '.from("pitches").select(PITCH_TRACKER_COLUMNS)'],
  [/\.from\("defensive_events"\)\.select\("\*"\)/g, '.from("defensive_events").select(DEFENSIVE_EVENT_COLUMNS)'],
  [/\.from\("player_ratings"\)\.select\("\*"\)/g, '.from("player_ratings").select(PLAYER_RATING_COLUMNS)'],
];
for (const [re, rep] of reps) src = src.replace(re, rep);

src = src.replace(/async function getSupabase\(\) \{[\s\S]*?\n\}\n\n/, "");
src = src.replace(
  /\/\*\* Defensive errors charged per player[\s\S]*?\n\}\n\n/,
  ""
);

const importInsert = `import { getSupabase, fetchFieldingErrorCountsForPlayers } from "./client";
import {
  GAME_COLUMNS,
  PLAYER_COLUMNS,
  PLATE_APPEARANCE_COLUMNS,
  BASERUNNING_EVENT_COLUMNS,
  PITCH_EVENT_COLUMNS,
  PITCH_TRACKER_COLUMNS,
  DEFENSIVE_EVENT_COLUMNS,
  PLAYER_RATING_COLUMNS,
} from "./columns";
`;

src = src.replace(/(from "@\/lib\/types";\n)/, `$1${importInsert}`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.ts"), src);

const remaining = (src.match(/select\("\*"\)/g) || []).length;
console.log(`Wrote index.ts (${src.split("\n").length} lines), remaining select("*"): ${remaining}`);
