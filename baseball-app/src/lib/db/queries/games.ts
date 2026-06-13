import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { Game, LineupSide } from "@/lib/types";
import { GAME_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { insertGameLineup, getSavedLineupWithSlots } from "./lineups";
import { getPlayers } from "./players";

export async function getGames(): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("games").select(GAME_COLUMNS).order("date", { ascending: false });
  return (data ?? []) as Game[];
}

/** Coach dashboard: prefer the game row most recently created (matches “just added this game”). */

export async function getGamesForCoachDashboard(): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("created_at", { ascending: false });
  return (data ?? []) as Game[];
}

/** Fetch only the games referenced by id (avoids loading full games table). */
export async function getGamesByIds(ids: string[]): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase || ids.length === 0) return [];
  const clean = [...new Set(ids.filter((id) => !isDemoId(id)))];
  if (clean.length === 0) return [];
  const { data } = await supabase.from("games").select(GAME_COLUMNS).in("id", clean);
  return (data ?? []) as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("games").select(GAME_COLUMNS).eq("id", id).single();
  return data as Game | null;
}

/** Omit from writes when null/empty so older `games` tables (pre-migration) still work. */
const GAME_OPTIONAL_COLUMNS_OMIT_WHEN_EMPTY = [
  "save_pitcher_id",
  "winning_pitcher_id",
  "losing_pitcher_id",
  "our_sp_plan_notes",
] as const satisfies readonly (keyof Game)[];

/**
 * Columns added after the initial `games` table (or optional text). When null/empty, omit them
 * from the insert body so PostgREST does not reject the request on older schema caches.
 */
function rowForGameInsert(game: Omit<Game, "id" | "created_at">): Record<string, unknown> {
  const g = { ...(game as Record<string, unknown>) };
  delete g.id;
  delete g.created_at;
  for (const k of GAME_OPTIONAL_COLUMNS_OMIT_WHEN_EMPTY) {
    const v = g[k as string];
    if (v == null || v === "") delete g[k as string];
  }
  return Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined));
}

function stripLegacyOptionalGameColumns(updates: Record<string, unknown>): Record<string, unknown> {
  const row = { ...updates };
  for (const k of GAME_OPTIONAL_COLUMNS_OMIT_WHEN_EMPTY) {
    const v = row[k as string];
    if (v === null || v === "" || v === undefined) delete row[k as string];
  }
  return row;
}

export async function insertGame(game: Omit<Game, "id" | "created_at">): Promise<Game> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Database unavailable");
  const row = rowForGameInsert(game);
  const { data, error } = await supabase.from("games").insert(row).select(GAME_COLUMNS).single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Insert returned no row");
  return data as Game;
}

/** Create a game and assign our lineup; optionally assign opponent lineup (same transaction of inserts). */
export async function createGameWithLineup(
  game: Omit<Game, "id" | "created_at">,
  savedLineupId?: string | null,
  opponentSlots?: { player_id: string; position?: string | null }[] | null,
  /** When set (e.g. from the lineup modal), overrides saved template / default. */
  ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
): Promise<Game> {
  const created = await insertGame(game);
  try {
    let slots: { player_id: string; position?: string | null }[] = [];
    const ourOverride = ourSlotsOverride?.filter((s) => s.player_id && !isDemoId(s.player_id)) ?? [];
    if (ourOverride.length > 0) {
      slots = ourOverride.map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
    } else if (savedLineupId && !isDemoId(savedLineupId)) {
      const saved = await getSavedLineupWithSlots(savedLineupId);
      if (saved?.slots?.length) {
        const ordered = [...saved.slots].sort((a, b) => a.slot - b.slot);
        slots = ordered
          .filter((s) => !isDemoId(s.player_id))
          .map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
      }
    }
    if (slots.length === 0) {
      const players = await getPlayers();
      const club = players.filter(
        (p) => !isDemoId(p.id) && isClubRosterPlayer(p) && !isPitcherPlayer(p)
      );
      slots = club.slice(0, 9).map((p) => ({ player_id: p.id, position: null }));
    }
    if (slots.length > 0) await insertGameLineup(created.id, created.our_side as LineupSide, slots);

    const opp = opponentSlots?.filter((s) => s.player_id && !isDemoId(s.player_id)) ?? [];
    if (opp.length > 0) {
      const opponentSide: LineupSide = created.our_side === "home" ? "away" : "home";
      await insertGameLineup(created.id, opponentSide, opp);
    }
    return created;
  } catch (e) {
    await deleteGame(created.id);
    throw e;
  }
}

export async function updateGame(
  id: string,
  updates: Partial<Omit<Game, "id" | "created_at">>
): Promise<Game | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return null;
  const row = stripLegacyOptionalGameColumns({ ...(updates as Record<string, unknown>) });
  const { data } = await supabase.from("games").update(row).eq("id", id).select(GAME_COLUMNS).single();
  return data as Game | null;
}

/** Replace one side's lineup for a game. Does not touch the other side. */
export async function replaceGameLineup(
  gameId: string,
  side: LineupSide,
  slots: { player_id: string; position?: string | null }[]
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return;
  await supabase.from("game_lineups").delete().eq("game_id", gameId).eq("side", side);
  if (slots.length > 0) await insertGameLineup(gameId, side, slots);
}

export async function deleteGame(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return false;
  const { error } = await supabase.from("games").delete().eq("id", id);
  return !error;
}

