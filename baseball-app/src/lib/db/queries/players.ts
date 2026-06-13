import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { kPctToKRate, type PlayerStatsForWatch } from "@/lib/playersToWatch";
import { getPlayerPrimaryPosition } from "@/lib/playerRoster";
import { isClubRosterPlayer, isPitcherPlayer, opponentNameKey } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { Game, PlateAppearance, Player, PlayerDeletionPreview } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS, PLAYER_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getBattingStatsForPlayers } from "./stats/batting";

export async function getPlayers(): Promise<Player[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("players").select(PLAYER_COLUMNS).order("name");
  return (data ?? []) as Player[];
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const supabase = await getSupabase();
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .in("id", ids);
  return (data ?? []) as Player[];
}

/**
 * Club roster plus both teams in a game (by opponent tag). Smaller payload than `getPlayers()` for Record / log.
 */

export async function getPlayersForGame(
  game: Pick<Game, "home_team" | "away_team">
): Promise<Player[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("players").select(PLAYER_COLUMNS).order("name");
  const awayKey = opponentNameKey(game.away_team);
  const homeKey = opponentNameKey(game.home_team);
  return ((data ?? []) as Player[]).filter((p) => {
    if (isClubRosterPlayer(p)) return true;
    const tag = p.opponent_team?.trim();
    if (!tag) return false;
    const key = opponentNameKey(tag);
    return key === awayKey || key === homeKey;
  });
}

export async function insertPlayer(
  player: Omit<Player, "id" | "created_at">
): Promise<Player | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("players").insert(player).select(PLAYER_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function updatePlayer(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return null;
  const { data, error } = await supabase.from("players").update(updates).eq("id", id).select(PLAYER_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function getPlayerDeletionPreview(playerId: string): Promise<PlayerDeletionPreview | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(playerId)) return null;
  const [pa, gl, sl] = await Promise.all([
    supabase.from("plate_appearances").select("id", { count: "exact", head: true }).eq("batter_id", playerId),
    supabase.from("game_lineups").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    supabase.from("saved_lineup_slots").select("id", { count: "exact", head: true }).eq("player_id", playerId),
  ]);
  return {
    batterPlateAppearances: pa.count ?? 0,
    gameLineups: gl.count ?? 0,
    savedLineupSlots: sl.count ?? 0,
  };
}

/**
 * Removes a player from active roster usage.
 * - If they have no batting PAs, hard-delete the player row.
 * - If they have batting PAs, archive the player (keep historical logs intact).
 * In both cases, clears `game_lineups` and `saved_lineup_slots` rows for this player first.
 */

export async function deletePlayer(playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(playerId)) return { ok: false, error: "Cannot delete this player." };

  const preview = await getPlayerDeletionPreview(playerId);
  if (!preview) return { ok: false, error: "Could not verify player data." };

  if (preview.gameLineups > 0) {
    const { error: e1 } = await supabase.from("game_lineups").delete().eq("player_id", playerId);
    if (e1) return { ok: false, error: e1.message };
  }
  if (preview.savedLineupSlots > 0) {
    const { error: e2 } = await supabase.from("saved_lineup_slots").delete().eq("player_id", playerId);
    if (e2) return { ok: false, error: e2.message };
  }

  // Keep historical PA integrity: if this player appears as a batter in past logs,
  // archive them off the club roster instead of hard-deleting the row.
  if (preview.batterPlateAppearances > 0) {
    const { error } = await supabase
      .from("players")
      .update({ opponent_team: "__archived__" })
      .eq("id", playerId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Roster batting + last 10 PAs (by `created_at`) for the Players to Watch dashboard card. */

export async function getPlayersToWatchInput(): Promise<PlayerStatsForWatch[]> {
  const supabase = await getSupabase();
  const players = await getPlayers();
  const list = players
    .filter((p) => !isDemoId(p.id))
    .filter((p) => isClubRosterPlayer(p))
    .filter((p) => !isPitcherPlayer(p));
  if (list.length === 0 || !supabase) return [];

  const ids = list.map((p) => p.id);
  const { data } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("batter_id", ids);

  const allPAs = (data ?? []) as PlateAppearance[];
  const byBatter = new Map<string, PlateAppearance[]>();
  for (const pa of allPAs) {
    if (isDemoId(pa.batter_id)) continue;
    const arr = byBatter.get(pa.batter_id) ?? [];
    arr.push(pa);
    byBatter.set(pa.batter_id, arr);
  }
  for (const [bid, arr] of byBatter) {
    arr.sort((a, b) => {
      const ta = a.created_at ?? "";
      const tb = b.created_at ?? "";
      return tb.localeCompare(ta);
    });
    byBatter.set(bid, arr);
  }

  const batting = await getBattingStatsForPlayers(ids);
  const out: PlayerStatsForWatch[] = [];

  for (const p of list) {
    const pas = byBatter.get(p.id) ?? [];
    const season = batting[p.id];
    const recent = pas.slice(0, 10);
    const last10Stats = recent.length > 0 ? battingStatsFromPAs(recent) : null;

    const last10Runs =
      recent.length > 0
        ? recent.reduce((sum, pa) => {
            const ids = pa.runs_scored_player_ids ?? [];
            return sum + ids.filter((id) => id === p.id).length;
          }, 0)
        : 0;

    const last10PA =
      last10Stats && recent.length > 0
        ? {
            avg: last10Stats.avg,
            obp: last10Stats.obp,
            slg: last10Stats.slg,
            ops: last10Stats.ops,
            hits: last10Stats.h ?? 0,
            ab: last10Stats.ab ?? 0,
            hr: last10Stats.hr ?? 0,
            double: last10Stats.double ?? 0,
            triple: last10Stats.triple ?? 0,
            rbi: last10Stats.rbi ?? 0,
            r: last10Runs,
            sb: last10Stats.sb ?? 0,
            strikeouts: last10Stats.so ?? 0,
            paCount: recent.length,
            kRate: kPctToKRate(last10Stats.kPct),
            bbRate: (last10Stats.bbPct ?? 0) * 100,
          }
        : undefined;

    out.push({
      id: p.id,
      name: p.name,
      position: getPlayerPrimaryPosition(p) ?? "—",
      pa: season?.pa ?? 0,
      avg: season?.avg ?? 0,
      obp: season?.obp ?? 0,
      slg: season?.slg ?? 0,
      ops: season?.ops ?? 0,
      kRate: kPctToKRate(season?.kPct),
      bbRate: (season?.bbPct ?? 0) * 100,
      last10PA,
    });
  }

  return out;
}

