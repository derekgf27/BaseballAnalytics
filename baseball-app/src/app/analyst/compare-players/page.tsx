import { Suspense } from "react";
import {
  getPlayers,
  getPlateAppearancesByBatter,
  getPlateAppearancesByPitcher,
  getBattingStatsWithSplitsForPlayers,
  getPitchingStatsForPlayers,
} from "@/lib/db/queries";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { BattingStatsWithSplits, PitchingStatsWithSplits } from "@/lib/types";
import { PlayerCompareClientGate } from "./PlayerCompareClientGate";

export default async function ComparePlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string; scope?: string }>;
}) {
  const { p1, p2 } = await searchParams;
  const players = await getPlayers();
  const roster = players.filter(isClubRosterPlayer);

  const playerA = p1 ? roster.find((p) => p.id === p1) ?? null : null;
  const playerB = p2 ? roster.find((p) => p.id === p2) ?? null : null;

  let battingA: BattingStatsWithSplits | null = null;
  let battingB: BattingStatsWithSplits | null = null;
  let pitchingA: PitchingStatsWithSplits | null = null;
  let pitchingB: PitchingStatsWithSplits | null = null;
  let sprayA: AnalystPlayerSpraySplits | null = null;
  let sprayB: AnalystPlayerSpraySplits | null = null;

  const ids = [playerA?.id, playerB?.id].filter(Boolean) as string[];
  if (ids.length > 0) {
    const [statsMap, pitchMap] = await Promise.all([
      getBattingStatsWithSplitsForPlayers(ids),
      getPitchingStatsForPlayers(ids),
    ]);
    if (playerA) battingA = statsMap[playerA.id] ?? null;
    if (playerB) battingB = statsMap[playerB.id] ?? null;
    if (playerA) pitchingA = pitchMap[playerA.id] ?? null;
    if (playerB) pitchingB = pitchMap[playerB.id] ?? null;
  }

  const pasPromises: Promise<unknown>[] = [];
  if (playerA) {
    pasPromises.push(
      (async () => {
        const [pasAbA, pasApA] = await Promise.all([
          getPlateAppearancesByBatter(playerA.id),
          getPlateAppearancesByPitcher(playerA.id),
        ]);
        sprayA = buildAnalystPlayerSpraySplits(playerA, players, pasAbA, pasApA);
      })()
    );
  }
  if (playerB) {
    pasPromises.push(
      (async () => {
        const [pasAbB, pasApB] = await Promise.all([
          getPlateAppearancesByBatter(playerB.id),
          getPlateAppearancesByPitcher(playerB.id),
        ]);
        sprayB = buildAnalystPlayerSpraySplits(playerB, players, pasAbB, pasApB);
      })()
    );
  }
  await Promise.all(pasPromises);

  return (
    <Suspense
      fallback={<div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-8" aria-hidden />}
    >
      <PlayerCompareClientGate
        roster={roster}
        playerA={playerA}
        playerB={playerB}
        battingA={battingA}
        battingB={battingB}
        pitchingA={pitchingA}
        pitchingB={pitchingB}
        sprayA={sprayA}
        sprayB={sprayB}
      />
    </Suspense>
  );
}
