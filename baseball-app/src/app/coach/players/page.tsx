import { getPlayers } from "@/lib/db/queries";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import { CoachPlayersClient } from "./CoachPlayersClient";

export const dynamic = "force-dynamic";

export default async function CoachPlayersPage() {
  const allPlayers = await getPlayers();
  const players = allPlayers.filter(isClubRosterPlayer);
  return <CoachPlayersClient players={players} />;
}
