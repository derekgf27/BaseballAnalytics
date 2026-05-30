import { getCachedPlayers } from "@/lib/db/cachedQueries";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import { CoachPlayersClientGate } from "./CoachPlayersClientGate";

export const dynamic = "force-dynamic";

export default async function CoachPlayersPage() {
  const allPlayers = await getCachedPlayers();
  const players = allPlayers.filter(isClubRosterPlayer);
  return <CoachPlayersClientGate players={players} />;
}
