import {
  getPlayers,
  getBattingStatsWithSplitsForPlayers,
  getPitchingStatsForPlayers,
  getClubBattingMatchupPayload,
  getClubPitchingMatchupPayload,
} from "@/lib/db/queries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { StatsPageClient } from "./StatsPageClient";

/** Always fetch fresh stats so recorded PAs (including SB, R, RBI, etc.) show up immediately. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StatsPage() {
  const allPlayers = await getPlayers();
  const club = allPlayers.filter(isClubRosterPlayer);
  /** Club roster — pitchers (position P) excluded from batting sheet only. */
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
    <StatsPageClient
      initialBatters={batters}
      initialPitchers={pitchers}
      initialBattingStatsWithSplits={battingStatsWithSplits}
      initialPitchingStatsWithSplits={pitchingStats}
      battingMatchupPayload={battingMatchupPayload}
      pitchingMatchupPayload={pitchingMatchupPayload}
      playerIdToName={playerIdToName}
    />
  );
}
