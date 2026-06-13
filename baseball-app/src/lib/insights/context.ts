import { isGameFinalized } from "@/lib/gameRecord";
import { isDemoId } from "@/lib/db/mockData";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import type { Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

export type InsightsContext = {
  /** Finalized games, newest first. */
  gamesNewestFirst: Game[];
  allPas: PlateAppearance[];
  pitchEvents: PitchEvent[];
  playersById: Map<string, Player>;
  /** Target game for pregame/postgame profiles. */
  focusGame?: Game | null;
  /** Limit player rules to these ids (player profile). */
  playerIds?: string[];
};

export function buildInsightsContext(input: {
  games: Game[];
  allPas: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  players: Player[];
  focusGameId?: string | null;
  playerIds?: string[];
}): InsightsContext {
  const gamesNewestFirst = input.games
    .filter((g) => !isDemoId(g.id) && isGameFinalized(g))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const playersById = new Map<string, Player>();
  for (const p of input.players) {
    if (!isDemoId(p.id)) playersById.set(p.id, p);
  }

  const focusGame =
    input.focusGameId != null
      ? gamesNewestFirst.find((g) => g.id === input.focusGameId) ??
        input.games.find((g) => g.id === input.focusGameId) ??
        null
      : null;

  return {
    gamesNewestFirst,
    allPas: input.allPas.filter((p) => !isDemoId(p.game_id)),
    pitchEvents: input.pitchEvents ?? [],
    playersById,
    focusGame,
    playerIds: input.playerIds,
  };
}

export function clubBatterIds(ctx: InsightsContext): Set<string> {
  const ids = new Set<string>();
  for (const p of ctx.playersById.values()) {
    if (isClubRosterPlayer(p) && !isPitcherPlayer(p)) ids.add(p.id);
  }
  return ids;
}

export function clubPitcherIds(ctx: InsightsContext): Set<string> {
  const ids = new Set<string>();
  for (const p of ctx.playersById.values()) {
    if (isClubRosterPlayer(p) && isPitcherPlayer(p)) ids.add(p.id);
  }
  return ids;
}

/** Games strictly before focus game (for pregame baselines). */
export function gamesBeforeFocus(ctx: InsightsContext): Game[] {
  if (!ctx.focusGame) return ctx.gamesNewestFirst;
  return ctx.gamesNewestFirst.filter(
    (g) => g.id !== ctx.focusGame!.id && g.date.localeCompare(ctx.focusGame!.date) < 0
  );
}

export function pitchEventsByPaId(events: PitchEvent[]): Map<string, PitchEvent[]> {
  const map = new Map<string, PitchEvent[]>();
  for (const e of events) {
    if (!e.pa_id) continue;
    const list = map.get(e.pa_id) ?? [];
    list.push(e);
    map.set(e.pa_id, list);
  }
  return map;
}
