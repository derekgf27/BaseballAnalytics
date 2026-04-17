import { getPlayers } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { isClubRosterPlayer, opponentNameKey } from "@/lib/opponentUtils";
import { RosterPageClient } from "./RosterPageClient";

export default async function RosterListPage({
  searchParams,
}: {
  searchParams: Promise<{ opponentTeam?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.opponentTeam;
  const opponentTeamParam = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  let defaultOpponentTeam: string | undefined;
  if (opponentTeamParam) {
    try {
      defaultOpponentTeam = decodeURIComponent(opponentTeamParam);
    } catch {
      defaultOpponentTeam = opponentTeamParam;
    }
  }

  const allPlayers = await getPlayers();
  const key = defaultOpponentTeam?.trim() ? opponentNameKey(defaultOpponentTeam.trim()) : null;
  /** Opponent roster: only players tagged for that team. Default: club roster only (no opponent/scout tags). */
  const players =
    key != null
      ? allPlayers.filter(
          (p) => p.opponent_team && opponentNameKey(p.opponent_team) === key
        )
      : allPlayers.filter(isClubRosterPlayer);
  const canEdit = hasSupabase();
  return (
    <RosterPageClient
      initialPlayers={players}
      canEdit={canEdit}
      defaultOpponentTeam={defaultOpponentTeam}
    />
  );
}
