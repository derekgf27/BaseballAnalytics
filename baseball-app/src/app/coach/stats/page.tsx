import { Suspense } from "react";
import {
  getPlayers,
  getBattingStatsWithSplitsForPlayers,
  getPitchingStatsForPlayers,
  getClubBattingMatchupPayload,
  getClubPitchingMatchupPayload,
} from "@/lib/db/queries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { coachPlayerProfileHref } from "@/lib/coachRoutes";
import { buildStatsUrlStateFromNextSearchParams } from "@/app/analyst/stats/statsUrlState";
import { StatsPageClient } from "@/app/analyst/stats/StatsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CoachStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statsUrlState = buildStatsUrlStateFromNextSearchParams(sp);

  const allPlayers = await getPlayers();
  const club = allPlayers.filter(isClubRosterPlayer);
  const batters = club.filter((p) => !isPitcherPlayer(p));
  const pitchers = club.filter(isPitcherPlayer);
  const batterIds = batters.map((p) => p.id);
  const pitcherIds = pitchers.map((p) => p.id);
  const [battingStatsWithSplits, pitchingStats, battingMatchupPayload, pitchingMatchupPayload] = await Promise.all([
    getBattingStatsWithSplitsForPlayers(batterIds),
    getPitchingStatsForPlayers(pitcherIds),
    getClubBattingMatchupPayload(batterIds),
    getClubPitchingMatchupPayload(pitcherIds),
  ]);
  const playerIdToName = Object.fromEntries(allPlayers.map((p) => [p.id, p.name]));

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--neo-text-muted)]">Loading stats…</div>}>
      <StatsPageClient
        statsUrlState={statsUrlState}
        initialBatters={batters}
        initialPitchers={pitchers}
        initialBattingStatsWithSplits={battingStatsWithSplits}
        initialPitchingStatsWithSplits={pitchingStats}
        battingMatchupPayload={battingMatchupPayload}
        pitchingMatchupPayload={pitchingMatchupPayload}
        playerIdToName={playerIdToName}
        playerProfileHref={coachPlayerProfileHref}
        showDataManagement={false}
      />
    </Suspense>
  );
}
