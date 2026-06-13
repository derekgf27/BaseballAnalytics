import { buildPitchTypeCountStateStatsByBatter } from "@/lib/compute/pitchTypeBattingCountState";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  BattingStatsWithSplits,
  PitchEvent,
  PitchTypeBucketKey,
  PitchTypeBucketProfile,
  PlateAppearance,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";
import type { SplitView } from "@/components/analyst/BattingStatsSheet";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";
import { gameOurSideByIdFromGames, type GameVenueSide } from "@/lib/compute/gameVenueSplits";
import type { Game } from "@/lib/types";

export function getBattingLineForPitchTypeSheet(
  splits: Record<string, BattingStatsWithSplits>,
  playerId: string,
  platoon: SplitView,
  venue: StatsVenueFilter,
  runners: StatsRunnersFilterKey
): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (runners === "all") {
    if (venue === "home") return s.home ?? undefined;
    if (venue === "away") return s.away ?? undefined;
    if (platoon === "overall") return s.overall;
    if (platoon === "vsL") return s.vsL ?? undefined;
    return s.vsR ?? undefined;
  }
  if (venue !== "all") return undefined;
  const triple = s.runnerSituations?.[runners];
  if (!triple) return undefined;
  if (platoon === "overall") return triple.combined ?? undefined;
  if (platoon === "vsL") return triple.vsL ?? undefined;
  return triple.vsR ?? undefined;
}

export function mergeCountStateBatBuckets(
  full: BattingStats["batBuckets"],
  atCount: BattingStats["batBuckets"]
): BattingStats["batBuckets"] {
  if (!full && !atCount) return undefined;
  const out: Partial<Record<PitchTypeBucketKey, PitchTypeBucketProfile>> = {};
  const keys = new Set<PitchTypeBucketKey>([
    ...(full ? (Object.keys(full) as PitchTypeBucketKey[]) : []),
    ...(atCount ? (Object.keys(atCount) as PitchTypeBucketKey[]) : []),
  ]);
  for (const key of keys) {
    const fullP = full?.[key];
    const countP = atCount?.[key];
    if (!fullP && !countP) continue;
    out[key] = {
      ...(fullP ?? { pitches: countP?.pitches ?? 0 }),
      ...(countP ?? {}),
      ab: fullP?.ab,
      h: fullP?.h,
      baa: fullP?.baa,
      obp: fullP?.obp,
      ops: fullP?.ops,
      kPct: fullP?.kPct,
      bbPct: fullP?.bbPct,
      hrPct: fullP?.hrPct,
      xbhPct: fullP?.xbhPct,
      slg: fullP?.slg,
      iso: fullP?.iso,
      gbPct: fullP?.gbPct,
      ldPct: fullP?.ldPct,
      fbPct: fullP?.fbPct,
      iffPct: fullP?.iffPct,
      paEnds: fullP?.paEnds,
      paEndPct: fullP?.paEndPct,
    };
  }
  return out;
}

export type BattingPitchTypeTeamRow = { player: Player; line: BattingStats };

export function buildBattingPitchTypeTeamRows(args: {
  players: Player[];
  battingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  pas?: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  games?: Pick<Game, "id" | "our_side">[];
  splitView: SplitView;
  venueFilter?: StatsVenueFilter;
  runnersFilter: StatsRunnersFilterKey;
  countState: BattingFinalCountBucketKey | null;
  searchQuery?: string;
}): BattingPitchTypeTeamRow[] {
  const {
    players,
    battingStatsWithSplits,
    pas,
    pitchEvents,
    games,
    splitView,
    venueFilter = "all",
    runnersFilter,
    countState,
    searchQuery = "",
  } = args;

  const gameOurSideById: Map<string, GameVenueSide> | undefined = games?.length
    ? gameOurSideByIdFromGames(games)
    : undefined;

  const countStateByBatter =
    countState != null
      ? buildPitchTypeCountStateStatsByBatter(
          players.map((p) => p.id),
          pas,
          pitchEvents,
          splitView,
          runnersFilter,
          countState,
          undefined,
          venueFilter,
          gameOurSideById
        )
      : {};

  const q = searchQuery.trim().toLowerCase();
  return players
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .map((p) => {
      const base = getBattingLineForPitchTypeSheet(
        battingStatsWithSplits,
        p.id,
        splitView,
        venueFilter,
        runnersFilter
      );
      const countOverride = countStateByBatter[p.id];
      const line: BattingStats | undefined =
        base && countOverride
          ? {
              ...base,
              batTyped: countOverride.batTyped ?? base.batTyped,
              batBuckets:
                countState != null
                  ? mergeCountStateBatBuckets(base.batBuckets, countOverride.batBuckets)
                  : countOverride.batBuckets ?? base.batBuckets,
              batBucketCounts: undefined,
            }
          : base;
      return { player: p, line: line! };
    })
    .filter((r) => r.line != null);
}
