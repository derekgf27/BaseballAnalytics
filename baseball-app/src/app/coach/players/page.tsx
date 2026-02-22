import { getPlayers } from "@/lib/db/queries";
import { CoachPlayersClient } from "./CoachPlayersClient";

export const dynamic = "force-dynamic";

export default async function CoachPlayersPage() {
  const players = await getPlayers();
  return <CoachPlayersClient players={players} />;
}
