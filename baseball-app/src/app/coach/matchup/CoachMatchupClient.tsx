"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPreGameOverview, type PreGameOverviewPayload } from "@/app/reports/actions";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import type { Game } from "@/lib/types";
import { CoachMatchupView } from "./CoachMatchupView";

function gameOptionLabel(g: Game) {
  return `${formatDateMMDDYYYY(g.date)} — ${matchupLabelUsFirst(g, true)}`;
}

function MatchupSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Loading matchup"
    >
      <div className="neo-card h-20 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="neo-card h-24 rounded-lg" />
        <div className="neo-card h-24 rounded-lg" />
      </div>
      <div className="neo-card h-32 rounded-lg" />
      <div className="neo-card h-64 rounded-lg" />
    </div>
  );
}

export function CoachMatchupClient({
  games,
  initialGameId,
  teamTrendInsights,
}: {
  games: Game[];
  initialGameId: string | null;
  teamTrendInsights: string[];
}) {
  const [gameId, setGameId] = useState(initialGameId ?? games[0]?.id ?? "");
  const [overview, setOverview] = useState<PreGameOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overviewCacheRef = useRef<Map<string, PreGameOverviewPayload>>(new Map());

  const selectedGame = useMemo(
    () => games.find((g) => g.id === gameId) ?? null,
    [games, gameId]
  );

  useEffect(() => {
    if (!gameId.trim()) {
      setOverview(null);
      setLoading(false);
      return;
    }

    const cached = overviewCacheRef.current.get(gameId);
    if (cached) {
      setOverview(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setOverview(null);
    setError(null);
    void (async () => {
      const res = await fetchPreGameOverview(gameId, teamTrendInsights);
      if (cancelled) return;
      if ("error" in res) {
        setOverview(null);
        setError(res.error);
      } else {
        overviewCacheRef.current.set(gameId, res);
        setOverview(res);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, teamTrendInsights]);

  return (
    <div className="app-shell min-h-full pb-8">
      <header className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
          Matchup
        </h1>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="min-h-[44px] min-w-[min(100%,14rem)] rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent-coach)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-coach)]/25"
          disabled={games.length === 0}
          aria-label="Game"
        >
          {games.length === 0 ? (
            <option value="">No games</option>
          ) : (
            games.map((g) => (
              <option key={g.id} value={g.id}>
                {gameOptionLabel(g)}
              </option>
            ))
          )}
        </select>
      </header>

      {error ? (
        <p
          className="mx-auto mb-4 max-w-6xl rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-dim)] px-4 py-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {games.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-[var(--text-muted)]">No games yet.</p>
      ) : loading && !overview ? (
        <MatchupSkeleton />
      ) : selectedGame && overview ? (
        <CoachMatchupView game={selectedGame} overview={overview} />
      ) : null}
    </div>
  );
}
