import { getPlayers } from "@/lib/db/queries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { SituationPageClient } from "./SituationPageClient";

export default async function CoachSituationPage() {
  const players = (await getPlayers())
    .filter(isClubRosterPlayer)
    .filter((p) => !isPitcherPlayer(p));
  return <SituationPageClient players={players} />;
}
