import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import {
  pitchTypeDistributionFromPitchLog,
  type PitchTypeDistributionResult,
} from "@/lib/compute/pitchTypeDistributionFromPitchLog";
import { platoonPitchingPasSplits } from "@/lib/compute/pitchingStats";
import { runsOnPaForLinescore } from "@/lib/compute/boxScore";
import type { Bats, Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

export function indexPasByPlayerId(
  pas: PlateAppearance[],
  idKey: "batter_id" | "pitcher_id"
): Map<string, PlateAppearance[]> {
  const map = new Map<string, PlateAppearance[]>();
  for (const pa of pas) {
    const id = pa[idKey];
    if (!id) continue;
    const list = map.get(id);
    if (list) list.push(pa);
    else map.set(id, [pa]);
  }
  return map;
}

export function batterBatsByIdFromPlayers(
  players: Player[]
): Map<string, Bats | null | undefined> {
  return new Map(players.map((p) => [p.id, p.bats ?? null]));
}

export function platoonPitchMixDistributions(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>,
  batterBatsById: Map<string, Bats | null | undefined>
): { vsLHB: PitchTypeDistributionResult; vsRHB: PitchTypeDistributionResult } {
  const { pasL, pasR } = platoonPitchingPasSplits(pas, batterBatsById);
  return {
    vsLHB: pitchTypeDistributionFromPitchLog(pasL, eventsByPaId),
    vsRHB: pitchTypeDistributionFromPitchLog(pasR, eventsByPaId),
  };
}

export function pitchEventsForPasList(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): PitchEvent[] {
  const out: PitchEvent[] = [];
  for (const pa of pas) {
    const events = eventsByPaId.get(pa.id);
    if (events?.length) out.push(...events);
  }
  return out;
}

export function buildPitchEventsByBatterId(
  pasByBatterId: Map<string, PlateAppearance[]>,
  eventsByPaId: Map<string, PitchEvent[]>
): Map<string, PitchEvent[]> {
  const map = new Map<string, PitchEvent[]>();
  for (const [batterId, batterPas] of pasByBatterId) {
    map.set(batterId, pitchEventsForPasList(batterPas, eventsByPaId));
  }
  return map;
}

export function gameFinalScoreLabel(game: Game, pasAll: PlateAppearance[]): string {
  let awayR = 0;
  let homeR = 0;
  for (const pa of pasAll) {
    const runs = runsOnPaForLinescore(pa);
    if (pa.inning_half === "top") awayR += runs;
    else homeR += runs;
  }
  return `${game.away_team} ${awayR}, ${game.home_team} ${homeR}`;
}

export { groupPitchEventsByPaId };
