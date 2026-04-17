import type { Game, LineupSide, Player } from "@/lib/types";

/**
 * Code-side classification for a player vs an opponent context (not shown in UI by default).
 * Use {@link getOpponentRosterTag} for queries, exports, or future features.
 */
export type OpponentRosterTagKind = "tagged" | "club_only" | "other_opponent";

/** True if the player is on your club roster (no opponent tag). Scouted / opposing players are excluded. */
export function isClubRosterPlayer(p: Player): boolean {
  return !p.opponent_team?.trim();
}

/** True if `positions` includes P — excluded from batting stats views and batter selection in Record PAs. */
export function isPitcherPlayer(p: Player): boolean {
  return p.positions.some((pos) => pos.trim().toUpperCase() === "P");
}

/**
 * When game lineups are empty, only players who belong on this away/home side (club vs opponent tag).
 */
export function playersForGameSideWhenNoLineup(
  game: Pick<Game, "home_team" | "away_team" | "our_side">,
  side: "away" | "home",
  allPlayers: Player[]
): Player[] {
  const isOurClubSide = game.our_side === side;
  if (isOurClubSide) {
    return allPlayers.filter(isClubRosterPlayer);
  }
  const teamName = side === "away" ? game.away_team : game.home_team;
  const key = opponentNameKey(teamName);
  return allPlayers.filter(
    (p) => p.opponent_team && opponentNameKey(p.opponent_team) === key
  );
}

/** Pitchers on roster for the club or opponent team at that home/away slot. */
export function pitchersForGameTeamSide(
  game: Pick<Game, "home_team" | "away_team" | "our_side">,
  side: "home" | "away",
  allPlayers: Player[]
): Player[] {
  const sidePlayers = playersForGameSideWhenNoLineup(game, side, allPlayers);
  return [...sidePlayers.filter(isPitcherPlayer)].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

/**
 * Classifies how a {@link Player} relates to a given opponent page name (`opponent_team` vs games-only).
 * Intended for application logic — not a user-visible label.
 */
export function getOpponentRosterTag(
  player: Player,
  opponentDisplayName: string
): {
  kind: OpponentRosterTagKind;
  shortLabel: string;
  title: string;
} {
  const o = player.opponent_team?.trim();
  if (!o) {
    return {
      kind: "club_only",
      shortLabel: "Roster",
      title:
        "This player is on the main roster with no opponent tag. They appear here from game lineups or plate appearances. Edit the player to set Opponent team, or fix the lineup in the game if they were assigned by mistake.",
    };
  }
  if (opponentNameKey(o) === opponentNameKey(opponentDisplayName)) {
    return {
      kind: "tagged",
      shortLabel: "Scouting",
      title: "Tagged as a player for this opponent organization.",
    };
  }
  return {
    kind: "other_opponent",
    shortLabel: `Opp: ${o}`,
    title: `Tagged for another opponent: ${o}`,
  };
}

/** Opposing team name for a game (the team that is not "us"). */
export function opponentTeamName(game: Game): string {
  return game.our_side === "home" ? game.away_team : game.home_team;
}

/** Our club name in this game. */
export function ourTeamName(game: Game): string {
  return game.our_side === "home" ? game.home_team : game.away_team;
}

/** Side the opponent occupies in the ballpark. */
export function opponentLineupSide(game: Game): LineupSide {
  return game.our_side === "home" ? "away" : "home";
}

/** Inning half when the opponent is batting. */
export function opponentBattingHalf(game: Game): "top" | "bottom" {
  return opponentLineupSide(game) === "away" ? "top" : "bottom";
}

/**
 * Normalize opponent labels so "Mayaguez", "mayaguez", and "Mayaguez " count as one team.
 */
export function opponentNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Unique opponent names from games (deduped by normalized key).
 * Display label is taken from the most recent game for that opponent (first hit in date-desc scan).
 */
export function uniqueOpponentNames(games: Game[]): string[] {
  const sorted = [...games].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const displayByKey = new Map<string, string>();
  for (const g of sorted) {
    const raw = opponentTeamName(g).trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const key = opponentNameKey(raw);
    if (!displayByKey.has(key)) displayByKey.set(key, raw);
  }
  const ordered: string[] = [];
  const added = new Set<string>();
  for (const g of sorted) {
    const raw = opponentTeamName(g).trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const key = opponentNameKey(raw);
    if (added.has(key)) continue;
    added.add(key);
    ordered.push(displayByKey.get(key)!);
  }
  return ordered;
}

export function gamesVsOpponent(games: Game[], opponentName: string): Game[] {
  const target = opponentNameKey(opponentName);
  return games.filter((g) => opponentNameKey(opponentTeamName(g)) === target);
}

/**
 * Merge opponent names from games (first, preserves game-derived order) with manually tracked names.
 * Dedupes by {@link opponentNameKey}.
 */
export function mergeOpponentNameLists(gameNames: string[], trackedNames: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of gameNames) {
    const raw = n.trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const k = opponentNameKey(raw);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
  }
  for (const n of trackedNames) {
    const raw = n.trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const k = opponentNameKey(raw);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
  }
  return out;
}
