"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import { BattingStatsSheet } from "@/components/analyst/BattingStatsSheet";
import { PitchingStatsSheet } from "@/components/analyst/PitchingStatsSheet";
import { computeBattingStatsWithSplitsFromPas } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { computePitchingStatsWithSplitsForRoster } from "@/lib/compute/pitchingStats";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst, opponentNameKey } from "@/lib/opponentUtils";
import { SPRAY_CHART_HIT_RESULTS, SPRAY_CHART_OUT_RESULTS } from "@/lib/sprayChartFilters";
import type {
  BattingStatsWithSplits,
  Bats,
  ClubBattingMatchupPayload,
  ClubPitchingMatchupPayload,
  Game,
  HitDirection,
  PitchingStatsWithSplits,
  Player,
} from "@/lib/types";

export interface OpponentDetailClientProps {
  opponentName: string;
  ourTeamLabel: string;
  games: Game[];
  players: Player[];
  /** Subset with at least one PA vs you — used when matchup toolbar is off. */
  battingStatsPlayers: Player[];
  /** Subset with at least one appearance vs you — used when matchup toolbar is off. */
  pitchingStatsPlayers: Player[];
  /** All tagged opponent hitters (for sheet rows when matchup filters are on). */
  battingPlayersForSheet: Player[];
  /** All tagged opponent pitchers (for sheet rows when matchup filters are on). */
  pitchingPlayersForSheet: Player[];
  opponentBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  opponentPitchingStatsWithSplits: Record<string, PitchingStatsWithSplits>;
  battingMatchupPayload?: ClubBattingMatchupPayload;
  pitchingMatchupPayload?: ClubPitchingMatchupPayload;
  opponentBattingPlayerIds: string[];
  opponentPitchingPlayerIds: string[];
  playerIdToName: Record<string, string>;
  sprayData: {
    game_id: string;
    batter_id: string;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
  }[];
  /** Balls in play when tagged opponent pitchers faced your batters (split vs LHB / vs RHB). */
  pitcherSprayData: {
    game_id: string;
    batter_id: string;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
  }[];
  /** False when no players are tagged for this opponent — stats sections still show with an empty state. */
  hasTaggedOpponentRoster: boolean;
}

function effectiveBatterHand(
  bats: "L" | "R" | "S" | undefined,
  pitcherHand: "L" | "R" | null
): "L" | "R" | null {
  if (bats === "L" || bats === "R") return bats;
  if (bats === "S") {
    if (pitcherHand === "L") return "R";
    if (pitcherHand === "R") return "L";
    return null;
  }
  return null;
}

export function OpponentDetailClient({
  opponentName,
  ourTeamLabel,
  games,
  players,
  battingStatsPlayers,
  pitchingStatsPlayers,
  battingPlayersForSheet,
  pitchingPlayersForSheet,
  opponentBattingStatsWithSplits,
  opponentPitchingStatsWithSplits,
  battingMatchupPayload,
  pitchingMatchupPayload,
  opponentBattingPlayerIds,
  opponentPitchingPlayerIds,
  playerIdToName,
  sprayData,
  pitcherSprayData,
  hasTaggedOpponentRoster,
}: OpponentDetailClientProps) {
  const [sprayResultFilter, setSprayResultFilter] = useState<"hits" | "outs" | "both">("hits");
  const [matchupPitcherId, setMatchupPitcherId] = useState("");
  const [pitchMatchupBatterId, setPitchMatchupBatterId] = useState("");

  /** Players tagged for this opponent page — everyone else is treated as our club for matchup filters. */
  const opponentTaggedIds = useMemo(() => {
    const key = opponentNameKey(opponentName);
    return new Set(
      players
        .filter((p) => p.opponent_team && opponentNameKey(p.opponent_team) === key)
        .map((p) => p.id)
    );
  }, [players, opponentName]);

  /** Our pitchers who faced these opponent hitters (not tagged for this opponent). */
  const ourTeamPitchersFlat = useMemo(() => {
    if (!battingMatchupPayload?.pas?.length) return null;
    const seen = new Set<string>();
    const rows: { id: string; name: string }[] = [];
    for (const pa of battingMatchupPayload.pas) {
      if (!pa.pitcher_id || opponentTaggedIds.has(pa.pitcher_id)) continue;
      if (seen.has(pa.pitcher_id)) continue;
      seen.add(pa.pitcher_id);
      rows.push({
        id: pa.pitcher_id,
        name: playerIdToName[pa.pitcher_id]?.trim() || "Unknown pitcher",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [battingMatchupPayload?.pas, opponentTaggedIds, playerIdToName]);

  /** Our batters who faced these opponent pitchers (not tagged for this opponent). */
  const ourTeamBattersFlat = useMemo(() => {
    if (!pitchingMatchupPayload?.pas?.length) return null;
    const seen = new Set<string>();
    const rows: { id: string; name: string }[] = [];
    for (const pa of pitchingMatchupPayload.pas) {
      if (!pa.batter_id || opponentTaggedIds.has(pa.batter_id)) continue;
      if (seen.has(pa.batter_id)) continue;
      seen.add(pa.batter_id);
      rows.push({
        id: pa.batter_id,
        name: playerIdToName[pa.batter_id]?.trim() || "Unknown batter",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [pitchingMatchupPayload?.pas, opponentTaggedIds, playerIdToName]);

  const startedGamesByPlayerBatting = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const raw = battingMatchupPayload?.startedGameIdsByPlayer ?? {};
    for (const [pid, ids] of Object.entries(raw)) {
      m.set(pid, new Set(ids as string[]));
    }
    return m;
  }, [battingMatchupPayload?.startedGameIdsByPlayer]);

  const filteredMatchupPas = useMemo(() => {
    if (!battingMatchupPayload || !matchupPitcherId) return null;
    return battingMatchupPayload.pas.filter((pa) => pa.pitcher_id === matchupPitcherId);
  }, [battingMatchupPayload, matchupPitcherId]);

  const filteredBattingPitchEvents = useMemo(() => {
    const raw = battingMatchupPayload?.pitchEvents ?? [];
    if (!filteredMatchupPas) return raw;
    const ids = new Set(filteredMatchupPas.map((p) => p.id));
    return raw.filter((e) => ids.has(e.pa_id));
  }, [battingMatchupPayload?.pitchEvents, filteredMatchupPas]);

  const displayBattingStatsWithSplits = useMemo(() => {
    if (!filteredMatchupPas || !battingMatchupPayload) return opponentBattingStatsWithSplits;
    return computeBattingStatsWithSplitsFromPas(
      opponentBattingPlayerIds,
      filteredMatchupPas,
      battingMatchupPayload.baserunningByPlayerId,
      startedGamesByPlayerBatting,
      filteredBattingPitchEvents
    );
  }, [
    filteredMatchupPas,
    filteredBattingPitchEvents,
    battingMatchupPayload,
    opponentBattingPlayerIds,
    startedGamesByPlayerBatting,
    opponentBattingStatsWithSplits,
  ]);

  const pitchStarterMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const raw = pitchingMatchupPayload?.starterGameIdsByPlayer ?? {};
    for (const [pid, ids] of Object.entries(raw)) {
      m.set(pid, new Set(ids as string[]));
    }
    return m;
  }, [pitchingMatchupPayload?.starterGameIdsByPlayer]);

  const pitchBatterBatsMap = useMemo(() => {
    const m = new Map<string, Bats | null | undefined>();
    const raw = pitchingMatchupPayload?.batterBatsById ?? {};
    for (const [id, bats] of Object.entries(raw)) {
      const ch = bats?.trim().toUpperCase()[0];
      if (ch === "L" || ch === "R" || ch === "S") m.set(id, ch as Bats);
      else m.set(id, null);
    }
    return m;
  }, [pitchingMatchupPayload?.batterBatsById]);

  const filteredPitchingMatchupPas = useMemo(() => {
    if (!pitchingMatchupPayload || !pitchMatchupBatterId) return null;
    return pitchingMatchupPayload.pas.filter((pa) => pa.batter_id === pitchMatchupBatterId);
  }, [pitchingMatchupPayload, pitchMatchupBatterId]);

  const filteredPitchingPitchEvents = useMemo(() => {
    const raw = pitchingMatchupPayload?.pitchEvents ?? [];
    if (!filteredPitchingMatchupPas) return raw;
    const ids = new Set(filteredPitchingMatchupPas.map((p) => p.id));
    return raw.filter((e) => ids.has(e.pa_id));
  }, [pitchingMatchupPayload?.pitchEvents, filteredPitchingMatchupPas]);

  const displayPitchingStatsWithSplits = useMemo(() => {
    if (!filteredPitchingMatchupPas || !pitchingMatchupPayload) return opponentPitchingStatsWithSplits;
    return computePitchingStatsWithSplitsForRoster(
      opponentPitchingPlayerIds,
      filteredPitchingMatchupPas,
      pitchStarterMap,
      pitchBatterBatsMap,
      filteredPitchingPitchEvents
    );
  }, [
    filteredPitchingMatchupPas,
    filteredPitchingPitchEvents,
    pitchingMatchupPayload,
    opponentPitchingPlayerIds,
    pitchStarterMap,
    pitchBatterBatsMap,
    opponentPitchingStatsWithSplits,
  ]);

  const battingSheetPlayers =
    battingMatchupPayload && battingPlayersForSheet.length > 0 ? battingPlayersForSheet : battingStatsPlayers;
  const pitchingSheetPlayers =
    pitchingMatchupPayload && pitchingPlayersForSheet.length > 0 ? pitchingPlayersForSheet : pitchingStatsPlayers;
  const batsByPlayerId = new Map<string, "L" | "R" | "S">();
  players.forEach((p) => {
    const b = p.bats?.toUpperCase();
    if (b === "L" || b === "R" || b === "S") batsByPlayerId.set(p.id, b as "L" | "R" | "S");
  });

  const validPAs = sprayData.filter(
    (pa): pa is typeof pa & { hit_direction: HitDirection } =>
      (pa.hit_direction === "pulled" || pa.hit_direction === "up_the_middle" || pa.hit_direction === "opposite_field")
  );
  const filteredPAs = validPAs.filter((pa) =>
    sprayResultFilter === "hits"
      ? SPRAY_CHART_HIT_RESULTS.has(pa.result)
      : sprayResultFilter === "outs"
        ? SPRAY_CHART_OUT_RESULTS.has(pa.result)
        : SPRAY_CHART_HIT_RESULTS.has(pa.result) || SPRAY_CHART_OUT_RESULTS.has(pa.result)
  );

  const rhbData: { hit_direction: HitDirection }[] = filteredPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  const lhbData: { hit_direction: HitDirection }[] = filteredPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  const rhbPAs = filteredPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const lhbPAs = filteredPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const rhbHits = rhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const lhbHits = lhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const rhbOuts = rhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;
  const lhbOuts = lhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const validPitcherSprayPAs = pitcherSprayData.filter(
    (pa): pa is typeof pa & { hit_direction: HitDirection } =>
      (pa.hit_direction === "pulled" || pa.hit_direction === "up_the_middle" || pa.hit_direction === "opposite_field")
  );
  const filteredPitcherPAs = validPitcherSprayPAs.filter((pa) =>
    sprayResultFilter === "hits"
      ? SPRAY_CHART_HIT_RESULTS.has(pa.result)
      : sprayResultFilter === "outs"
        ? SPRAY_CHART_OUT_RESULTS.has(pa.result)
        : SPRAY_CHART_HIT_RESULTS.has(pa.result) || SPRAY_CHART_OUT_RESULTS.has(pa.result)
  );

  const pitcherVsLhbData: { hit_direction: HitDirection }[] = filteredPitcherPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  const pitcherVsRhbData: { hit_direction: HitDirection }[] = filteredPitcherPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  const pitcherLhbPAs = filteredPitcherPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const pitcherRhbPAs = filteredPitcherPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const pitcherLhbHits = pitcherLhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitcherRhbHits = pitcherRhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitcherLhbOuts = pitcherLhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;
  const pitcherRhbOuts = pitcherRhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          {opponentName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {games.length} game{games.length === 1 ? "" : "s"} vs {ourTeamLabel}. Open Roster for hitters and opposing pitchers.
          {hasTaggedOpponentRoster
            ? ` Batting stats and spray charts use only tagged opponent players. Hitter spray is when they batted against ${ourTeamLabel}; pitcher spray is balls in play when they faced ${ourTeamLabel} hitters.`
            : " Add opponent players in View roster to see batting stats and spray charts from recorded games."}
        </p>
      </div>

      {/* Roster + Games — side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Roster</h2>
            <Link
              href={`/analyst/roster?opponentTeam=${encodeURIComponent(opponentName)}`}
              className="font-display inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
            >
              View roster
            </Link>
          </div>
        </section>

        <section className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Games</h2>
          {games.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">No games vs this opponent yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {games.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 text-[var(--text)]">
                    {formatDateMMDDYYYY(g.date)} — {matchupLabelUsFirst(g, true)}
                  </span>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/analyst/games/${g.id}/log`}
                      className="font-display inline-flex items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                    >
                      Log
                    </Link>
                    <Link
                      href={`/analyst/games/${g.id}/review`}
                      className="font-display inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Batting stats — section always visible; empty state when no tagged roster or no PAs */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-5">
        {!hasTaggedOpponentRoster ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Batting stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No opponent players tagged yet. Use Roster → View roster to add players for {opponentName}; stats will show
              here once they have plate appearances vs you.
            </p>
          </div>
        ) : battingStatsPlayers.length === 0 ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Batting stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No plate appearances recorded yet for tagged opponent players. Pitchers and others without PAs vs you appear
              in View roster only.
            </p>
          </div>
        ) : (
          <BattingStatsSheet
            players={battingSheetPlayers}
            battingStatsWithSplits={displayBattingStatsWithSplits}
            heading="Batting stats"
            subheading={`${opponentName} vs ${ourTeamLabel} — tagged opponent players only; PAs when they batted against you.`}
            splitDisabled={!!matchupPitcherId}
            matchupToolbar={
              battingMatchupPayload?.games?.length && ourTeamPitchersFlat
                ? {
                    opponents: [],
                    pitchersByOpponent: {},
                    opponentKey: "",
                    pitcherId: matchupPitcherId,
                    onOpponentChange: () => {},
                    onPitcherChange: setMatchupPitcherId,
                    pitchersFlat: ourTeamPitchersFlat,
                  }
                : undefined
            }
          />
        )}
      </section>

      {/* Pitching stats — section always visible; empty state when no tagged roster or no pitching appearances */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-5">
        {!hasTaggedOpponentRoster ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Pitching stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No opponent players tagged yet. Use Roster → View roster to add players for {opponentName}; pitching
              stats will show here once tagged pitchers appear against you.
            </p>
          </div>
        ) : pitchingStatsPlayers.length === 0 ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Pitching stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No pitching appearances recorded yet for tagged opponent pitchers.
            </p>
          </div>
        ) : (
          <PitchingStatsSheet
            players={pitchingSheetPlayers}
            pitchingStatsWithSplits={displayPitchingStatsWithSplits}
            heading="Pitching stats"
            subheading={`${opponentName} vs ${ourTeamLabel} — tagged opponent pitchers only; PAs when they pitched against you.`}
            splitDisabled={!!pitchMatchupBatterId}
            matchupToolbar={
              pitchingMatchupPayload?.games?.length && ourTeamBattersFlat
                ? {
                    opponents: [],
                    battersByOpponent: {},
                    opponentKey: "",
                    batterId: pitchMatchupBatterId,
                    onOpponentChange: () => {},
                    onBatterChange: setPitchMatchupBatterId,
                    battersFlat: ourTeamBattersFlat,
                  }
                : undefined
            }
          />
        )}
      </section>

      {/* Spray charts — hitter (opponent batting) + pitcher (opponent pitching) */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Spray charts</h2>
          <label className="flex items-center gap-2 text-xs">
            <span className="font-display uppercase tracking-wider text-white">Filter</span>
            <select
              value={sprayResultFilter}
              onChange={(e) => setSprayResultFilter(e.target.value as "hits" | "outs" | "both")}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Spray chart result filter"
            >
              <option value="hits">Hits</option>
              <option value="outs">Outs</option>
              <option value="both">Hits + Outs</option>
            </select>
          </label>
        </div>
        {!hasTaggedOpponentRoster ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Tag opponent players in View roster to see spray data from games when those players put the ball in play.
          </p>
        ) : (
          <div className="mt-6 space-y-10">
            <div>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                When hitting vs {ourTeamLabel}
              </h3>
              {filteredPAs.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  No spray-direction data for the selected filter yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                    <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                      Right-handed batters
                    </h4>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      RHB and switch hitters when batting right (vs LHP).
                    </p>
                    <p className="mt-1 text-xs tabular-nums">
                      <span className="text-[var(--accent)]">{rhbPAs.length}</span>
                      <span className="text-white"> PA: </span>
                      <span className="text-[var(--accent)]">{rhbHits}</span>
                      <span className="text-white"> Hits</span>
                      <span className="text-white"> · </span>
                      <span className="text-[var(--accent)]">{rhbOuts}</span>
                      <span className="text-white"> Outs</span>
                    </p>
                    <div className="mt-4 min-h-[280px]">
                      <TeamSprayChart data={rhbData} hand="R" />
                    </div>
                  </section>
                  <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                    <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                      Left-handed batters
                    </h4>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      LHB and switch hitters when batting left (vs RHP).
                    </p>
                    <p className="mt-1 text-xs tabular-nums">
                      <span className="text-[var(--accent)]">{lhbPAs.length}</span>
                      <span className="text-white"> PA: </span>
                      <span className="text-[var(--accent)]">{lhbHits}</span>
                      <span className="text-white"> Hits</span>
                      <span className="text-white"> · </span>
                      <span className="text-[var(--accent)]">{lhbOuts}</span>
                      <span className="text-white"> Outs</span>
                    </p>
                    <div className="mt-4 min-h-[280px]">
                      <TeamSprayChart data={lhbData} hand="L" />
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                When pitching vs {ourTeamLabel}
              </h3>
              {pitchingStatsPlayers.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  No tagged opponent pitchers with recorded appearances — pitcher spray will appear once they pitch against{" "}
                  {ourTeamLabel}.
                </p>
              ) : filteredPitcherPAs.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  No spray-direction data for opponent pitchers for the selected filter yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                    <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs LHB</h4>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {ourTeamLabel} left-handed batters and switch hitters batting left (vs RHP).
                    </p>
                    <p className="mt-1 text-xs tabular-nums">
                      <span className="text-[var(--accent)]">{pitcherLhbPAs.length}</span>
                      <span className="text-white"> PA: </span>
                      <span className="text-[var(--accent)]">{pitcherLhbHits}</span>
                      <span className="text-white"> Hits</span>
                      <span className="text-white"> · </span>
                      <span className="text-[var(--accent)]">{pitcherLhbOuts}</span>
                      <span className="text-white"> Outs</span>
                    </p>
                    <div className="mt-4 min-h-[280px]">
                      <TeamSprayChart data={pitcherVsLhbData} hand="L" />
                    </div>
                  </section>
                  <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                    <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs RHB</h4>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {ourTeamLabel} right-handed batters and switch hitters batting right (vs LHP).
                    </p>
                    <p className="mt-1 text-xs tabular-nums">
                      <span className="text-[var(--accent)]">{pitcherRhbPAs.length}</span>
                      <span className="text-white"> PA: </span>
                      <span className="text-[var(--accent)]">{pitcherRhbHits}</span>
                      <span className="text-white"> Hits</span>
                      <span className="text-white"> · </span>
                      <span className="text-[var(--accent)]">{pitcherRhbOuts}</span>
                      <span className="text-white"> Outs</span>
                    </p>
                    <div className="mt-4 min-h-[280px]">
                      <TeamSprayChart data={pitcherVsRhbData} hand="R" />
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
