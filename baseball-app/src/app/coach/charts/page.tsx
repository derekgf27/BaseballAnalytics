import { Suspense } from "react";
import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { getChartsPagePlateData } from "@/lib/db/queries";
import { ChartsClientGate } from "@/app/analyst/charts/ChartsClientGate";

export default async function CoachChartsPage() {
  const [{ sprayData, pitchingSprayData, chartPas }, players, games] = await Promise.all([
    getChartsPagePlateData(),
    getCachedPlayers(),
    getCachedGames(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-10" aria-label="Loading charts" />
      }
    >
      <ChartsClientGate
        sprayData={sprayData}
        pitchingSprayData={pitchingSprayData}
        chartPas={chartPas}
        players={players}
        games={games}
      />
    </Suspense>
  );
}
