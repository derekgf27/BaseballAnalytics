import { Suspense } from "react";
import {
  getTeamPlateAppearancesForSpray,
  getTeamPlateAppearancesForPitchingSpray,
  getTeamPlateAppearancesForCharts,
  getPlayers,
  getGames,
} from "@/lib/db/queries";
import { ChartsClient } from "./ChartsClient";

export default async function ChartsPage() {
  const [sprayData, pitchingSprayData, chartPas, players, games] = await Promise.all([
    getTeamPlateAppearancesForSpray(),
    getTeamPlateAppearancesForPitchingSpray(),
    getTeamPlateAppearancesForCharts(),
    getPlayers(),
    getGames(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-10" aria-label="Loading charts" />
      }
    >
      <ChartsClient
        sprayData={sprayData}
        pitchingSprayData={pitchingSprayData}
        chartPas={chartPas}
        players={players}
        games={games}
      />
    </Suspense>
  );
}
