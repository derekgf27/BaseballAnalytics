import { Suspense } from "react";
import {
  getTeamPlateAppearancesForSpray,
  getTeamPlateAppearancesForPitchingSpray,
  getPlayers,
} from "@/lib/db/queries";
import { ChartsClient } from "./ChartsClient";

export default async function ChartsPage() {
  const [sprayData, pitchingSprayData, players] = await Promise.all([
    getTeamPlateAppearancesForSpray(),
    getTeamPlateAppearancesForPitchingSpray(),
    getPlayers(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-10" aria-label="Loading charts" />
      }
    >
      <ChartsClient sprayData={sprayData} pitchingSprayData={pitchingSprayData} players={players} />
    </Suspense>
  );
}
