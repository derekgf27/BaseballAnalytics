import { getPlayers } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { PlayersPageClient } from "./PlayersPageClient";

export default async function PlayersListPage() {
  const players = await getPlayers();
  const canEdit = hasSupabase();
  return <PlayersPageClient initialPlayers={players} canEdit={canEdit} />;
}
