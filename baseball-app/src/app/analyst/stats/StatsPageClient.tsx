"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clearAllStatsAction } from "@/app/analyst/games/actions";
import { BattingStatsSheet } from "@/components/analyst/BattingStatsSheet";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { PitchingStatsSheet } from "@/components/analyst/PitchingStatsSheet";
import { computeBattingStatsWithSplitsFromPas } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { computePitchingStatsWithSplitsForRoster } from "@/lib/compute/pitchingStats";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
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
  /** Player name links (e.g. coach portal uses `/coach/players/...`). */
  playerProfileHref?: (playerId: string) => string;
  /** When false, hide destructive “clear all stats” (coach stats page). */
  showDataManagement?: boolean;
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
  playerProfileHref = analystPlayerProfileHref,
  showDataManagement = true,
}: StatsPageClientProps) {
  const batters = initialBatters ?? initialPlayers ?? [];
  const batterIds = useMemo(() => batters.map((p) => p.id), [batters]);
  const pitchers = initialPitchers ?? [];
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useHydrationSafeStatsUrl(statsUrlState, searchParams);

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
  const matchupOpponentKey = url.bo;
  const matchupPitcherId = url.bp;
  const pitchMatchupOpponentKey = url.po;
  const pitchMatchupBatterId = url.pb;
  const battingFinalCount = parseFinalCountParam(url.bfc);
  const pitchingFinalCount = parseFinalCountParam(url.pfc);
  const battingRunners = parseRunnersParam(url.bbs);
  const pitchingRunners = parseRunnersParam(url.pbs);

  const setTab = (t: StatsTab) => {
    replaceQuery((p) => {
      p.set("tab", t === "pitching" ? "p" : "b");
    });
  };
  const setMatchupOpponentKey = (key: string) => {
    replaceQuery((p) => {
      if (key) p.set("bo", key);
      else p.delete("bo");
      p.delete("bp");
    });
  };
  const setMatchupPitcherId = (id: string) => {
    replaceQuery((p) => {
      if (id) p.set("bp", id);
      else p.delete("bp");
    });
  };
  const setPitchMatchupOpponentKey = (key: string) => {
    replaceQuery((p) => {
      if (key) p.set("po", key);
      else p.delete("po");
      p.delete("pb");
    });
  };
  const setPitchMatchupBatterId = (id: string) => {
    replaceQuery((p) => {
      if (id) p.set("pb", id);
      else p.delete("pb");
    });
  };
  const setBattingFinalCount = useCallback(
    (v: BattingFinalCountBucketKey | null) => {
      replaceQuery((p) => {
        if (v) p.set("bfc", v);
        else p.delete("bfc");
      });
    },
    [replaceQuery]
  );
  const setPitchingFinalCount = useCallback(
    (v: BattingFinalCountBucketKey | null) => {
      replaceQuery((p) => {
        if (v) p.set("pfc", v);
        else p.delete("pfc");
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
    replaceQuery((p) => {
      for (const k of ["bo", "bp", "bbs", "bfc", "po", "pb", "pbs", "pfc"] as const) {
        p.delete(k);
      }
    });
  }, [replaceQuery]);

  const [clearingAll, setClearingAll] = useState(false);
  const [clearStatsConfirmOpen, setClearStatsConfirmOpen] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
    if (!battingMatchupPayload || !matchupOpponentKey) return null;
    const gameIdSet = new Set(
      battingMatchupPayload.games
        .filter((g) => opponentNameKey(opponentTeamName(g)) === matchupOpponentKey)
        .map((g) => g.id)
    );
    let list = battingMatchupPayload.pas.filter((pa) => gameIdSet.has(pa.game_id));
    if (matchupPitcherId) list = list.filter((pa) => pa.pitcher_id === matchupPitcherId);
    return list;
  }, [battingMatchupPayload, matchupOpponentKey, matchupPitcherId]);

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

  const displayBattingStatsWithSplits = useMemo(() => {
    if (!filteredMatchupPas || !battingMatchupPayload) return initialBattingStatsWithSplits;
    return computeBattingStatsWithSplitsFromPas(
      batterIds,
      filteredMatchupPas,
      battingMatchupPayload.baserunningByPlayerId,
      startedGamesByPlayer,
      filteredBattingPitchEvents
    );
  }, [
    filteredMatchupPas,
    filteredBattingPitchEvents,
    battingMatchupPayload,
    batterIds,
    startedGamesByPlayer,
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
    if (!pitchingMatchupPayload || !pitchMatchupOpponentKey) return null;
    const gameIdSet = new Set(
      pitchingMatchupPayload.games
        .filter((g) => opponentNameKey(opponentTeamName(g)) === pitchMatchupOpponentKey)
        .map((g) => g.id)
    );
    let list = pitchingMatchupPayload.pas.filter((pa) => gameIdSet.has(pa.game_id));
    if (pitchMatchupBatterId) list = list.filter((pa) => pa.batter_id === pitchMatchupBatterId);
    return list;
  }, [pitchingMatchupPayload, pitchMatchupOpponentKey, pitchMatchupBatterId]);

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

  const pitchBatterBatsByIdObj = useMemo(
    () => Object.fromEntries(Array.from(pitchBatterBatsMap.entries())),
    [pitchBatterBatsMap]
  );

  const displayPitchingStatsWithSplits = useMemo(() => {
    if (!filteredPitchingMatchupPas || !pitchingMatchupPayload) return initialPitchingStatsWithSplits;
    return computePitchingStatsWithSplitsForRoster(
      pitcherIds,
      filteredPitchingMatchupPas,
      pitchStarterMap,
      pitchBatterBatsMap,
      filteredPitchingPitchEvents
    );
  }, [
    filteredPitchingMatchupPas,
    filteredPitchingPitchEvents,
    pitchingMatchupPayload,
    pitcherIds,
    pitchStarterMap,
    pitchBatterBatsMap,
    initialPitchingStatsWithSplits,
  ]);

  const hasResettableFilters = useMemo(
    () =>
      battingRunners !== "all" ||
      pitchingRunners !== "all" ||
      battingFinalCount != null ||
      pitchingFinalCount != null ||
      !!matchupOpponentKey ||
      !!matchupPitcherId ||
      !!pitchMatchupOpponentKey ||
      !!pitchMatchupBatterId,
    [
      battingRunners,
      pitchingRunners,
      battingFinalCount,
      pitchingFinalCount,
      matchupOpponentKey,
      matchupPitcherId,
      pitchMatchupOpponentKey,
      pitchMatchupBatterId,
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
          <BattingStatsSheet
            players={batters}
            battingStatsWithSplits={displayBattingStatsWithSplits}
            pas={displayBattingPas}
            pitchEvents={displayBattingPitchEvents}
            splitDisabled={!!matchupPitcherId}
            finalCountBucket={battingFinalCount}
            onFinalCountBucketChange={setBattingFinalCount}
            runnersFilter={battingRunners}
            onRunnersFilterChange={setBattingRunners}
            toolbarVariant="grouped"
            sampleToolbarEnd={sampleResetFiltersButton}
            matchupToolbar={
              battingMatchupPayload && matchupOpponents.length > 0
                ? {
                    opponents: matchupOpponents,
                    pitchersByOpponent: matchupPitchersByOpponent,
                    opponentKey: matchupOpponentKey,
                    pitcherId: matchupPitcherId,
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
          <PitchingStatsSheet
            players={pitchers}
            pitchingStatsWithSplits={displayPitchingStatsWithSplits}
            pas={displayPitchingPas}
            pitchEvents={displayPitchingPitchEvents}
            batterBatsById={pitchBatterBatsByIdObj}
            splitDisabled={!!pitchMatchupBatterId}
            finalCountBucket={pitchingFinalCount}
            onFinalCountBucketChange={setPitchingFinalCount}
            runnersFilter={pitchingRunners}
            onRunnersFilterChange={setPitchingRunners}
            toolbarVariant="grouped"
            sampleToolbarEnd={sampleResetFiltersButton}
            matchupToolbar={
              pitchingMatchupPayload && pitchMatchupOpponents.length > 0
                ? {
                    opponents: pitchMatchupOpponents,
                    battersByOpponent: pitchMatchupBattersByOpponent,
                    opponentKey: pitchMatchupOpponentKey,
                    batterId: pitchMatchupBatterId,
                    onOpponentChange: setPitchMatchupOpponentKey,
                    onBatterChange: setPitchMatchupBatterId,
                  }
                : undefined
            }
            playerProfileHref={playerProfileHref}
          />
        </div>
      )}

      {showDataManagement ? (
        <>
          <details className="group rounded-lg border border-[var(--border)]/80 bg-[var(--bg-elevated)]/20">
            <summary className="cursor-pointer list-none px-4 py-3 font-display text-sm font-semibold text-[var(--text-muted)] marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-[var(--text)] group-open:rotate-90 transition-transform">▸</span>
                Data management
              </span>
              <span className="mt-0.5 block text-xs font-normal font-sans text-[var(--text-muted)]">
                Destructive actions — clear all plate appearances and baserunning from the database.
              </span>
            </summary>
            <div className="border-t border-[var(--border)]/50 px-4 pb-4 pt-3" style={{ borderColor: "var(--danger)" }}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--danger)" }}>
                Clear all stats
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Permanently delete every plate appearance and baserunning event in the database. Batting stats and trends
                will reset.
              </p>
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => setClearStatsConfirmOpen(true)}
                className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                {clearingAll ? "Clearing…" : "Clear all stats"}
              </button>
              {clearMessage && (
                <p
                  className={`mt-3 text-sm ${clearMessage.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
                >
                  {clearMessage.text}
                </p>
              )}
            </div>
          </details>

          <ConfirmDeleteDialog
            open={clearStatsConfirmOpen}
            onClose={() => !clearingAll && setClearStatsConfirmOpen(false)}
            title="Clear all stats?"
            description="This permanently deletes every plate appearance and baserunning event in the database for all games. Batting and pitching stats will reset. This cannot be undone."
            confirmLabel="Clear all stats"
            pendingLabel="Clearing…"
            pending={clearingAll}
            onConfirm={async () => {
              setClearingAll(true);
              setClearMessage(null);
              const result = await clearAllStatsAction();
              setClearingAll(false);
              setClearStatsConfirmOpen(false);
              if (result.ok) {
                setClearMessage({
                  type: "ok",
                  text: result.count > 0 ? `Cleared ${result.count} plate appearance(s).` : "No PAs to clear.",
                });
                router.refresh();
              } else {
                setClearMessage({ type: "err", text: result.error ?? "Failed to clear stats." });
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
