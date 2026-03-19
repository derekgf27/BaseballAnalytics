import { getTeamPlateAppearancesForSpray, getPlayers } from "@/lib/db/queries";
import { ChartsClient } from "./ChartsClient";

export default async function ChartsPage() {
  const [sprayData, players] = await Promise.all([
    getTeamPlateAppearancesForSpray(),
    getPlayers(),
  ]);
  return <ChartsClient sprayData={sprayData} players={players} />;
}
