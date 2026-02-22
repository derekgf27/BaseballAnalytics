import { getPlayers } from "@/lib/db/queries";
import { SituationPageClient } from "./SituationPageClient";

export default async function CoachSituationPage() {
  const players = await getPlayers();
  return <SituationPageClient players={players} />;
}
