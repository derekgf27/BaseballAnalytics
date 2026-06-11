"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SplitView } from "@/components/analyst/BattingStatsSheet";
import { TeamBattingStatsSections } from "@/components/analyst/TeamBattingStatsSections";
import { TeamPitchingStatsSections } from "@/components/analyst/TeamPitchingStatsSections";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import type { PitchingSplitView } from "@/components/analyst/PitchingStatsSheet";
import { computeBattingStatsWithSplitsFromPas } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { computePitchingStatsWithSplitsForRoster } from "@/lib/compute/pitchingStats";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { coachPlayerProfileHref } from "@/lib/coachRoutes";
import { opponentNameKey, opponentTeamName, uniqueOpponentNames } from "@/lib/opponentUtils";
import { buildStatsUrlState, type StatsPageUrlState } from "./statsUrlState";
import type {
  BattingFinalCountBucketKey,
  BattingStatsWithSplits,
  Bats,
  ClubBattingMatchupPayload,
  ClubPitchingMatchupPayload,
  PitchingStatsWithSplits,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";

const VALID_FINAL_COUNT = new Set(
  FINAL_COUNT_BUCKET_OPTIONS.map((o) => o.value) as BattingFinalCountBucketKey[]
);

function parseFinalCountParam(s: string | null): BattingFinalCountBucketKey | null {
  if (!s) return null;
  return VALID_FINAL_COUNT.has(s as BattingFinalCountBucketKey) ? (s as BattingFinalCountBucketKey) : null;
}

function parseRunnersParam(s: string | null): StatsRunnersFilterKey {
  switch (s) {
    case "e":
    case "empty":
      return "basesEmpty";
    case "on":
      return "runnersOn";
    case "r":
    case "risp":
      return "risp";
    case "l":
    case "loaded":
      return "basesLoaded";
    default:
      return "all";
  }
}

function runnersParamForQuery(v: StatsRunnersFilterKey): string | null {
  switch (v) {
    case "all":
      return null;
    case "basesEmpty":
      return "e";
    case "runnersOn":
      return "on";
    case "risp":
      return "r";
    case "basesLoaded":
      return "l";
    default:
      return null;
  }
}

type StatsTab = "batting" | "pitching";

/**
 * After SSR, the first client render must match the server HTML. `useSearchParams()` can disagree
 * with the server-parsed `statsUrlState` on that frame; `useSyncExternalStore` + getServerSnapshot
 * is also unreliable across Next/React versions. Keep URL-driven UI on `serverState` until mount.
 */
function useHydrationSafeStatsUrl(
  serverState: StatsPageUrlState,
  searchParams: ReturnType<typeof useSearchParams>
): StatsPageUrlState {
  const fromHook = useMemo(
    () => buildStatsUrlState((k) => searchParams.get(k)),
    [searchParams]
  );
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated ? fromHook : serverState;
}

interface StatsPageClientProps {
  initialBatters?: Player[];
  initialPitchers?: Player[];
  /** @deprecated Prefer `initialBatters` — kept so older RSC payloads that only pass this still work. */
  initialPlayers?: Player[];
  initialBattingStatsWithSplits?: Record<string, BattingStatsWithSplits>;
  initialPitchingStatsWithSplits?: Record<string, PitchingStatsWithSplits>;
  battingMatchupPayload?: ClubBattingMatchupPayload;
  pitchingMatchupPayload?: ClubPitchingMatchupPayload;
  playerIdToName?: Record<string, string>;
  /** Parsed from the request URL on the server — keeps SSR HTML in sync with the first client render (see `useSearchParams` hydration notes). */
  statsUrlState: StatsPageUrlState;
}

export function StatsPageClient({
  initialBatters,
  initialPitchers,
  initialPlayers,
  initialBattingStatsWithSplits = {},
  initialPitchingStatsWithSplits = {},
  battingMatchupPayload,
  pitchingMatchupPayload,
  playerIdToName = {},
  statsUrlState,
}: StatsPageClientProps) {
  const batters = initialBatters ?? initialPlayers ?? [];
  const batterIds = useMemo(() => batters.map((p) => p.id), [batters]);
  const pitchers = initialPitchers ?? [];
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useHydrationSafeStatsUrl(statsUrlState, searchParams);

  const playerProfileHref = useMemo(
    () => (pathname?.startsWith("/coach") ? coachPlayerProfileHref : analystPlayerProfileHref),
    [pathname]
  );

  /**
   * Optimistic overlay while `router.replace` updates search params. Without this, a URL→state
   * sync effect can reset the filter before the query string catches up (stats stay full season).
   */
  const [optimisticBatOpponent, setOptimisticBatOpponent] = useState<string | null>(null);
  const [optimisticBatPitcher, setOptimisticBatPitcher] = useState<string | null>(null);
  const [optimisticPitchOpponent, setOptimisticPitchOpponent] = useState<string | null>(null);
  const [optimisticPitchBatter, setOptimisticPitchBatter] = useState<string | null>(null);

  const batOpponentKey = optimisticBatOpponent !== null ? optimisticBatOpponent : url.bo;
  const batPitcherId = optimisticBatPitcher !== null ? optimisticBatPitcher : url.bp;
  const pitchOpponentKey = optimisticPitchOpponent !== null ? optimisticPitchOpponent : url.po;
  const pitchBatterId = optimisticPitchBatter !== null ? optimisticPitchBatter : url.pb;

  useEffect(() => {
    if (optimisticBatOpponent !== null && url.bo === optimisticBatOpponent) {
      setOptimisticBatOpponent(null);
    }
  }, [url.bo, optimisticBatOpponent]);

  useEffect(() => {
    if (optimisticBatPitcher !== null && url.bp === optimisticBatPitcher) {
      setOptimisticBatPitcher(null);
    }
  }, [url.bp, optimisticBatPitcher]);

  useEffect(() => {
    if (optimisticPitchOpponent !== null && url.po === optimisticPitchOpponent) {
      setOptimisticPitchOpponent(null);
    }
  }, [url.po, optimisticPitchOpponent]);

  useEffect(() => {
    if (optimisticPitchBatter !== null && url.pb === optimisticPitchBatter) {
      setOptimisticPitchBatter(null);
    }
  }, [url.pb, optimisticPitchBatter]);

  const replaceQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutate(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const tab: StatsTab = url.tab === "p" ? "pitching" : "batting";
  const battingFinalCountParam = parseFinalCountParam(url.bfc);
  const battingFinalCount: BattingFinalCountBucketKey = battingFinalCountParam ?? "0-0";
  const battingDisciplineCountParam = parseFinalCountParam(url.bdc ?? null);
  const [battingSearch, setBattingSearch] = useState("");
  const [battingSplit, setBattingSplit] = useState<SplitView>("overall");
  const [disciplineSplit, setDisciplineSplit] = useState<SplitView>("overall");
  const [disciplineRunners, setDisciplineRunners] = useState<StatsRunnersFilterKey>("all");
  const [finalCountSplit, setFinalCountSplit] = useState<SplitView>("overall");
  const [finalCountRunners, setFinalCountRunners] = useState<StatsRunnersFilterKey>("all");
  const pitchingFinalCountParam = parseFinalCountParam(url.pfc);
  const pitchingFinalCount: BattingFinalCountBucketKey = pitchingFinalCountParam ?? "0-0";
  const pitchingDisciplineCountParam = parseFinalCountParam(url.pdc ?? null);
  const pitchingPitchTypesCountParam = parseFinalCountParam(url.ppc ?? null);
  const [pitchingSearch, setPitchingSearch] = useState("");
  const [pitchingSplit, setPitchingSplit] = useState<PitchingSplitView>("overall");
  const [pitchDisciplineSplit, setPitchDisciplineSplit] = useState<PitchingSplitView>("overall");
  const [pitchDisciplineRunners, setPitchDisciplineRunners] = useState<StatsRunnersFilterKey>("all");
  const [pitchFinalCountSplit, setPitchFinalCountSplit] = useState<PitchingSplitView>("overall");
  const [pitchFinalCountRunners, setPitchFinalCountRunners] = useState<StatsRunnersFilterKey>("all");
  const [pitchTypesSplit, setPitchTypesSplit] = useState<PitchingSplitView>("overall");
  const [pitchTypesRunners, setPitchTypesRunners] = useState<StatsRunnersFilterKey>("all");
  const battingRunners = parseRunnersParam(url.bbs);
  const pitchingRunners = parseRunnersParam(url.pbs);

  const setTab = (t: StatsTab) => {
    replaceQuery((p) => {
      p.set("tab", t === "pitching" ? "p" : "b");
    });
  };
  const setMatchupOpponentKey = useCallback(
    (key: string) => {
      const norm = key ? opponentNameKey(key) : "";
      setOptimisticBatOpponent(norm);
      setOptimisticBatPitcher("");
      replaceQuery((p) => {
        if (norm) p.set("bo", norm);
        else p.delete("bo");
        p.delete("bp");
      });
    },
    [replaceQuery]
  );
  const setMatchupPitcherId = useCallback(
    (id: string) => {
      setOptimisticBatPitcher(id);
      replaceQuery((p) => {
        if (id) p.set("bp", id);
        else p.delete("bp");
      });
    },
    [replaceQuery]
  );
  const setPitchMatchupOpponentKey = useCallback(
    (key: string) => {
      const norm = key ? opponentNameKey(key) : "";
      setOptimisticPitchOpponent(norm);
      setOptimisticPitchBatter("");
      replaceQuery((p) => {
        if (norm) p.set("po", norm);
        else p.delete("po");
        p.delete("pb");
      });
    },
    [replaceQuery]
  );
  const setPitchMatchupBatterId = useCallback(
    (id: string) => {
      setOptimisticPitchBatter(id);
      replaceQuery((p) => {
        if (id) p.set("pb", id);
        else p.delete("pb");
      });
    },
    [replaceQuery]
  );
  const setBattingFinalCount = useCallback(
    (v: BattingFinalCountBucketKey) => {
      replaceQuery((p) => {
        if (v === "0-0") p.delete("bfc");
        else p.set("bfc", v);
      });
    },
    [replaceQuery]
  );
  const setBattingDisciplineCount = useCallback(
    (v: BattingFinalCountBucketKey | null) => {
      replaceQuery((p) => {
        if (v) p.set("bdc", v);
        else p.delete("bdc");
      });
    },
    [replaceQuery]
  );
  const setBattingRunners = useCallback(
    (v: StatsRunnersFilterKey) => {
      replaceQuery((p) => {
        const q = runnersParamForQuery(v);
        if (q) p.set("bbs", q);
        else p.delete("bbs");
      });
    },
    [replaceQuery]
  );
  const setPitchingFinalCount = useCallback(
    (v: BattingFinalCountBucketKey) => {
      replaceQuery((p) => {
        if (v === "0-0") p.delete("pfc");
        else p.set("pfc", v);
      });
    },
    [replaceQuery]
  );
  const setPitchingDisciplineCount = useCallback(
    (v: BattingFinalCountBucketKey | null) => {
      replaceQuery((p) => {
        if (v) p.set("pdc", v);
        else p.delete("pdc");
      });
    },
    [replaceQuery]
  );
  const setPitchingPitchTypesCount = useCallback(
    (v: BattingFinalCountBucketKey | null) => {
      replaceQuery((p) => {
        if (v) p.set("ppc", v);
        else p.delete("ppc");
      });
    },
    [replaceQuery]
  );
  const setPitchingRunners = useCallback(
    (v: StatsRunnersFilterKey) => {
      replaceQuery((p) => {
        const q = runnersParamForQuery(v);
        if (q) p.set("pbs", q);
        else p.delete("pbs");
      });
    },
    [replaceQuery]
  );

  const resetAllStatsFilters = useCallback(() => {
    setOptimisticBatOpponent("");
    setOptimisticBatPitcher("");
    setOptimisticPitchOpponent("");
    setOptimisticPitchBatter("");
    setBattingSearch("");
    setBattingSplit("overall");
    setDisciplineSplit("overall");
    setDisciplineRunners("all");
    setFinalCountSplit("overall");
    setFinalCountRunners("all");
    setPitchingSearch("");
    setPitchingSplit("overall");
    setPitchDisciplineSplit("overall");
    setPitchDisciplineRunners("all");
    setPitchFinalCountSplit("overall");
    setPitchFinalCountRunners("all");
    setPitchTypesSplit("overall");
    setPitchTypesRunners("all");
    replaceQuery((p) => {
      for (const k of ["bo", "bp", "bbs", "bfc", "bdc", "po", "pb", "pbs", "pfc", "pdc", "ppc"] as const) {
        p.delete(k);
      }
    });
  }, [replaceQuery]);

  const matchupOpponents = useMemo(() => {
    if (!battingMatchupPayload?.games?.length) return [];
    return uniqueOpponentNames(battingMatchupPayload.games).map((label) => ({
      key: opponentNameKey(label),
      label,
    }));
  }, [battingMatchupPayload?.games]);

  const matchupPitchersByOpponent = useMemo(() => {
    if (!battingMatchupPayload) return {} as Record<string, { id: string; name: string }[]>;
    const { pas, games } = battingMatchupPayload;
    const gameIdsByOpponent = new Map<string, Set<string>>();
    for (const g of games) {
      const key = opponentNameKey(opponentTeamName(g));
      if (!gameIdsByOpponent.has(key)) gameIdsByOpponent.set(key, new Set());
      gameIdsByOpponent.get(key)!.add(g.id);
    }
    const out: Record<string, { id: string; name: string }[]> = {};
    for (const [oppKey, gids] of gameIdsByOpponent) {
      const seen = new Set<string>();
      const rows: { id: string; name: string }[] = [];
      for (const pa of pas) {
        if (!pa.pitcher_id || !gids.has(pa.game_id)) continue;
        if (seen.has(pa.pitcher_id)) continue;
        seen.add(pa.pitcher_id);
        rows.push({
          id: pa.pitcher_id,
          name: playerIdToName[pa.pitcher_id]?.trim() || "Unknown pitcher",
        });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      out[oppKey] = rows;
    }
    return out;
  }, [battingMatchupPayload, playerIdToName]);

  const startedGamesByPlayer = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const raw = battingMatchupPayload?.startedGameIdsByPlayer ?? {};
    for (const [pid, ids] of Object.entries(raw)) {
      m.set(pid, new Set(ids as string[]));
    }
    return m;
  }, [battingMatchupPayload?.startedGameIdsByPlayer]);

  const filteredMatchupPas = useMemo(() => {
    if (!battingMatchupPayload || !batOpponentKey) return null;
    const gameById = new Map(battingMatchupPayload.games.map((g) => [g.id, g]));
    let list = battingMatchupPayload.pas.filter((pa) => {
      if (!pa.game_id) return false;
      const game = gameById.get(pa.game_id);
      if (!game) return false;
      return opponentNameKey(opponentTeamName(game)) === batOpponentKey;
    });
    if (batPitcherId) list = list.filter((pa) => pa.pitcher_id === batPitcherId);
    return list;
  }, [battingMatchupPayload, batOpponentKey, batPitcherId]);

  const filteredBattingPitchEvents = useMemo(() => {
    const raw = battingMatchupPayload?.pitchEvents ?? [];
    if (!filteredMatchupPas) return raw;
    const ids = new Set(filteredMatchupPas.map((p) => p.id));
    return raw.filter((e) => ids.has(e.pa_id));
  }, [battingMatchupPayload?.pitchEvents, filteredMatchupPas]);

  const displayBattingPas = useMemo(
    () => filteredMatchupPas ?? battingMatchupPayload?.pas ?? [],
    [filteredMatchupPas, battingMatchupPayload?.pas]
  );

  const displayBattingPitchEvents = useMemo(
    () => (filteredMatchupPas ? filteredBattingPitchEvents : battingMatchupPayload?.pitchEvents ?? []),
    [filteredMatchupPas, filteredBattingPitchEvents, battingMatchupPayload?.pitchEvents]
  );

  const startedGamesForBattingRecompute = useMemo(() => {
    if (!filteredMatchupPas) return startedGamesByPlayer;
    const gameIds = new Set(filteredMatchupPas.map((p) => p.game_id).filter(Boolean) as string[]);
    const m = new Map<string, Set<string>>();
    for (const [pid, ids] of startedGamesByPlayer) {
      const kept = [...ids].filter((id) => gameIds.has(id));
      if (kept.length > 0) m.set(pid, new Set(kept));
    }
    return m;
  }, [filteredMatchupPas, startedGamesByPlayer]);

  const displayBattingStatsWithSplits = useMemo(() => {
    if (!batOpponentKey || !battingMatchupPayload) return initialBattingStatsWithSplits;
    return computeBattingStatsWithSplitsFromPas(
      batterIds,
      filteredMatchupPas ?? [],
      battingMatchupPayload.baserunningByPlayerId,
      startedGamesForBattingRecompute,
      filteredBattingPitchEvents
    );
  }, [
    batOpponentKey,
    filteredMatchupPas,
    filteredBattingPitchEvents,
    battingMatchupPayload,
    batterIds,
    startedGamesForBattingRecompute,
    initialBattingStatsWithSplits,
  ]);

  const pitchMatchupOpponents = useMemo(() => {
    if (!pitchingMatchupPayload?.games?.length) return [];
    return uniqueOpponentNames(pitchingMatchupPayload.games).map((label) => ({
      key: opponentNameKey(label),
      label,
    }));
  }, [pitchingMatchupPayload?.games]);

  const pitchMatchupBattersByOpponent = useMemo(() => {
    if (!pitchingMatchupPayload) return {} as Record<string, { id: string; name: string }[]>;
    const { pas, games } = pitchingMatchupPayload;
    const gameIdsByOpponent = new Map<string, Set<string>>();
    for (const g of games) {
      const key = opponentNameKey(opponentTeamName(g));
      if (!gameIdsByOpponent.has(key)) gameIdsByOpponent.set(key, new Set());
      gameIdsByOpponent.get(key)!.add(g.id);
    }
    const out: Record<string, { id: string; name: string }[]> = {};
    for (const [oppKey, gids] of gameIdsByOpponent) {
      const seen = new Set<string>();
      const rows: { id: string; name: string }[] = [];
      for (const pa of pas) {
        if (!pa.batter_id || !gids.has(pa.game_id)) continue;
        if (seen.has(pa.batter_id)) continue;
        seen.add(pa.batter_id);
        rows.push({
          id: pa.batter_id,
          name: playerIdToName[pa.batter_id]?.trim() || "Unknown batter",
        });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      out[oppKey] = rows;
    }
    return out;
  }, [pitchingMatchupPayload, playerIdToName]);

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
    if (!pitchingMatchupPayload || !pitchOpponentKey) return null;
    const gameById = new Map(pitchingMatchupPayload.games.map((g) => [g.id, g]));
    let list = pitchingMatchupPayload.pas.filter((pa) => {
      if (!pa.game_id) return false;
      const game = gameById.get(pa.game_id);
      if (!game) return false;
      return opponentNameKey(opponentTeamName(game)) === pitchOpponentKey;
    });
    if (pitchBatterId) list = list.filter((pa) => pa.batter_id === pitchBatterId);
    return list;
  }, [pitchingMatchupPayload, pitchOpponentKey, pitchBatterId]);

  const filteredPitchingPitchEvents = useMemo(() => {
    const raw = pitchingMatchupPayload?.pitchEvents ?? [];
    if (!filteredPitchingMatchupPas) return raw;
    const ids = new Set(filteredPitchingMatchupPas.map((p) => p.id));
    return raw.filter((e) => ids.has(e.pa_id));
  }, [pitchingMatchupPayload?.pitchEvents, filteredPitchingMatchupPas]);

  const displayPitchingPas = useMemo(
    () => filteredPitchingMatchupPas ?? pitchingMatchupPayload?.pas ?? [],
    [filteredPitchingMatchupPas, pitchingMatchupPayload?.pas]
  );

  const displayPitchingPitchEvents = useMemo(
    () => (filteredPitchingMatchupPas ? filteredPitchingPitchEvents : pitchingMatchupPayload?.pitchEvents ?? []),
    [filteredPitchingMatchupPas, filteredPitchingPitchEvents, pitchingMatchupPayload?.pitchEvents]
  );

  const pitchStarterMapForRecompute = useMemo(() => {
    if (!filteredPitchingMatchupPas) return pitchStarterMap;
    const gameIds = new Set(filteredPitchingMatchupPas.map((p) => p.game_id).filter(Boolean) as string[]);
    const m = new Map<string, Set<string>>();
    for (const [pid, ids] of pitchStarterMap) {
      const kept = [...ids].filter((id) => gameIds.has(id));
      if (kept.length > 0) m.set(pid, new Set(kept));
    }
    return m;
  }, [filteredPitchingMatchupPas, pitchStarterMap]);

  /** Games in the current pitching sample (for official W–L–SV when recomputing from filtered PAs). */
  const displayPitchingGames = useMemo(() => {
    if (!pitchingMatchupPayload?.games?.length) return undefined;
    const pas = filteredPitchingMatchupPas ?? pitchingMatchupPayload.pas;
    const gameIds = new Set(pas.map((p) => p.game_id).filter(Boolean) as string[]);
    return pitchingMatchupPayload.games.filter((g) => gameIds.has(g.id));
  }, [pitchingMatchupPayload, filteredPitchingMatchupPas]);

  const pitchBatterBatsByIdObj = useMemo(
    () => Object.fromEntries(Array.from(pitchBatterBatsMap.entries())),
    [pitchBatterBatsMap]
  );

  const displayPitchingStatsWithSplits = useMemo(() => {
    if (!pitchOpponentKey || !pitchingMatchupPayload) return initialPitchingStatsWithSplits;
    return computePitchingStatsWithSplitsForRoster(
      pitcherIds,
      filteredPitchingMatchupPas ?? [],
      pitchStarterMapForRecompute,
      pitchBatterBatsMap,
      filteredPitchingPitchEvents,
      displayPitchingGames
    );
  }, [
    pitchOpponentKey,
    filteredPitchingMatchupPas,
    filteredPitchingPitchEvents,
    pitchingMatchupPayload,
    pitcherIds,
    pitchStarterMapForRecompute,
    pitchBatterBatsMap,
    initialPitchingStatsWithSplits,
    displayPitchingGames,
  ]);

  const battingSampleSubheading = useMemo(() => {
    if (!batOpponentKey) return undefined;
    const oppLabel = matchupOpponents.find((o) => o.key === batOpponentKey)?.label ?? batOpponentKey;
    if (batPitcherId) {
      const pitcherName = playerIdToName[batPitcherId]?.trim() || "selected pitcher";
      return `Showing stats vs ${oppLabel} (pitcher: ${pitcherName}) — not full season`;
    }
    return `Showing stats vs ${oppLabel} — not full season`;
  }, [batOpponentKey, batPitcherId, matchupOpponents, playerIdToName]);

  const pitchingSampleSubheading = useMemo(() => {
    if (!pitchOpponentKey) return undefined;
    const oppLabel = pitchMatchupOpponents.find((o) => o.key === pitchOpponentKey)?.label ?? pitchOpponentKey;
    if (pitchBatterId) {
      const batterName = playerIdToName[pitchBatterId]?.trim() || "selected batter";
      return `Showing stats vs ${oppLabel} (batter: ${batterName}) — not full season`;
    }
    return `Showing stats vs ${oppLabel} — not full season`;
  }, [pitchOpponentKey, pitchBatterId, pitchMatchupOpponents, playerIdToName]);

  const hasResettableFilters = useMemo(
    () =>
      battingRunners !== "all" ||
      battingSplit !== "overall" ||
      disciplineSplit !== "overall" ||
      disciplineRunners !== "all" ||
      battingDisciplineCountParam != null ||
      finalCountSplit !== "overall" ||
      finalCountRunners !== "all" ||
      pitchingRunners !== "all" ||
      pitchingSplit !== "overall" ||
      pitchDisciplineSplit !== "overall" ||
      pitchDisciplineRunners !== "all" ||
      pitchingDisciplineCountParam != null ||
      pitchingPitchTypesCountParam != null ||
      pitchFinalCountSplit !== "overall" ||
      pitchFinalCountRunners !== "all" ||
      pitchTypesSplit !== "overall" ||
      pitchTypesRunners !== "all" ||
      battingFinalCountParam != null ||
      pitchingFinalCountParam != null ||
      battingSearch.trim().length > 0 ||
      pitchingSearch.trim().length > 0 ||
      !!batOpponentKey ||
      !!batPitcherId ||
      !!pitchOpponentKey ||
      !!pitchBatterId,
    [
      battingRunners,
      battingSplit,
      disciplineSplit,
      disciplineRunners,
      battingDisciplineCountParam,
      finalCountSplit,
      finalCountRunners,
      pitchingRunners,
      pitchingSplit,
      pitchDisciplineSplit,
      pitchDisciplineRunners,
      pitchingDisciplineCountParam,
      pitchingPitchTypesCountParam,
      pitchFinalCountSplit,
      pitchFinalCountRunners,
      pitchTypesSplit,
      pitchTypesRunners,
      battingFinalCountParam,
      pitchingFinalCountParam,
      battingSearch,
      pitchingSearch,
      batOpponentKey,
      batPitcherId,
      pitchOpponentKey,
      pitchBatterId,
    ]
  );

  const sampleResetFiltersButton = useMemo(
    () => (
      <button
        type="button"
        onClick={resetAllStatsFilters}
        disabled={!hasResettableFilters}
        className={`rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
          hasResettableFilters
            ? "text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            : "cursor-not-allowed text-[var(--text-muted)] opacity-60"
        }`}
      >
        Reset all filters
      </button>
    ),
    [hasResettableFilters, resetAllStatsFilters]
  );

  const onStatsTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setTab(e.key === "ArrowRight" ? "pitching" : "batting");
    }
  };

  const statsTabToggle = (
    <div
      role="tablist"
      aria-label="Batting or pitching stats"
      onKeyDown={onStatsTabKeyDown}
      className="inline-flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
    >
      <button
        type="button"
        role="tab"
        id="stats-tab-batting"
        aria-selected={tab === "batting"}
        aria-controls="stats-panel-batting"
        tabIndex={tab === "batting" ? 0 : -1}
        onClick={() => setTab("batting")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition ${
          tab === "batting"
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Batters
      </button>
      <button
        type="button"
        role="tab"
        id="stats-tab-pitching"
        aria-selected={tab === "pitching"}
        aria-controls="stats-panel-pitching"
        tabIndex={tab === "pitching" ? 0 : -1}
        onClick={() => setTab("pitching")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition ${
          tab === "pitching"
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Pitchers
      </button>
    </div>
  );

  const pageTitle = tab === "pitching" ? "Stats — Pitching" : "Stats — Batting";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1
          id="stats-page-heading"
          className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]"
        >
          {pageTitle}
        </h1>
        {statsTabToggle}
      </div>

      {tab === "batting" ? (
        <div role="tabpanel" id="stats-panel-batting" aria-labelledby="stats-tab-batting">
          <TeamBattingStatsSections
            players={batters}
            battingStatsWithSplits={displayBattingStatsWithSplits}
            pas={displayBattingPas}
            pitchEvents={displayBattingPitchEvents}
            startedGameIdsByPlayer={battingMatchupPayload?.startedGameIdsByPlayer}
            subheading={battingSampleSubheading}
            splitDisabled={!!batPitcherId}
            splitView={battingSplit}
            onSplitViewChange={setBattingSplit}
            runnersFilter={battingRunners}
            onRunnersFilterChange={setBattingRunners}
            disciplineSplit={disciplineSplit}
            onDisciplineSplitChange={setDisciplineSplit}
            disciplineRunners={disciplineRunners}
            onDisciplineRunnersChange={setDisciplineRunners}
            disciplineCount={battingDisciplineCountParam}
            onDisciplineCountChange={setBattingDisciplineCount}
            finalCountSplit={finalCountSplit}
            onFinalCountSplitChange={setFinalCountSplit}
            finalCountRunners={finalCountRunners}
            onFinalCountRunnersChange={setFinalCountRunners}
            finalCountBucket={battingFinalCount}
            onFinalCountBucketChange={setBattingFinalCount}
            searchQuery={battingSearch}
            onSearchQueryChange={setBattingSearch}
            sampleToolbarEnd={sampleResetFiltersButton}
            matchupToolbar={
              battingMatchupPayload && matchupOpponents.length > 0
                ? {
                    opponents: matchupOpponents,
                    pitchersByOpponent: matchupPitchersByOpponent,
                    opponentKey: batOpponentKey,
                    pitcherId: batPitcherId,
                    onOpponentChange: setMatchupOpponentKey,
                    onPitcherChange: setMatchupPitcherId,
                  }
                : undefined
            }
            playerProfileHref={playerProfileHref}
          />
        </div>
      ) : (
        <div role="tabpanel" id="stats-panel-pitching" aria-labelledby="stats-tab-pitching">
          <TeamPitchingStatsSections
            players={pitchers}
            pitchingStatsWithSplits={displayPitchingStatsWithSplits}
            pas={displayPitchingPas}
            pitchEvents={displayPitchingPitchEvents}
            starterGameIdsByPlayer={pitchingMatchupPayload?.starterGameIdsByPlayer}
            subheading={pitchingSampleSubheading}
            batterBatsById={pitchBatterBatsByIdObj}
            splitDisabled={!!pitchBatterId}
            splitView={pitchingSplit}
            onSplitViewChange={setPitchingSplit}
            runnersFilter={pitchingRunners}
            onRunnersFilterChange={setPitchingRunners}
            disciplineSplit={pitchDisciplineSplit}
            onDisciplineSplitChange={setPitchDisciplineSplit}
            disciplineRunners={pitchDisciplineRunners}
            onDisciplineRunnersChange={setPitchDisciplineRunners}
            disciplineCount={pitchingDisciplineCountParam}
            onDisciplineCountChange={setPitchingDisciplineCount}
            finalCountSplit={pitchFinalCountSplit}
            onFinalCountSplitChange={setPitchFinalCountSplit}
            finalCountRunners={pitchFinalCountRunners}
            onFinalCountRunnersChange={setPitchFinalCountRunners}
            finalCountBucket={pitchingFinalCount}
            onFinalCountBucketChange={setPitchingFinalCount}
            pitchTypesSplit={pitchTypesSplit}
            onPitchTypesSplitChange={setPitchTypesSplit}
            pitchTypesRunners={pitchTypesRunners}
            onPitchTypesRunnersChange={setPitchTypesRunners}
            pitchTypesCount={pitchingPitchTypesCountParam}
            onPitchTypesCountChange={setPitchingPitchTypesCount}
            searchQuery={pitchingSearch}
            onSearchQueryChange={setPitchingSearch}
            sampleToolbarEnd={sampleResetFiltersButton}
            matchupToolbar={
              pitchingMatchupPayload && pitchMatchupOpponents.length > 0
                ? {
                    opponents: pitchMatchupOpponents,
                    battersByOpponent: pitchMatchupBattersByOpponent,
                    opponentKey: pitchOpponentKey,
                    batterId: pitchBatterId,
                    onOpponentChange: setPitchMatchupOpponentKey,
                    onBatterChange: setPitchMatchupBatterId,
                  }
                : undefined
            }
            playerProfileHref={playerProfileHref}
          />
        </div>
      )}
    </div>
  );
}
