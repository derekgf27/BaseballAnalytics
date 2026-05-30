"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { unmountCaptureStyles } from "@/lib/reports/htmlElementPdf";
import { downloadPreGameReportPdf } from "@/lib/reports/preGameReportPdf";
import { downloadPostGameReportPdf } from "@/lib/reports/postGameReportPdf";
import { downloadTeamTrendsReportPdf } from "@/lib/reports/teamTrendsReportPdf";
import {
  fetchPreGameOverview,
  fetchReportsBatterStats,
  fetchReportsGamePayload,
  type PreGameOverviewPayload,
} from "@/app/reports/actions";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import type { TeamTrendPoint } from "@/lib/reports/teamTrendsSnapshot";
import type { BattingStatsWithSplits, Game, PlateAppearance, Player } from "@/lib/types";
import type { PostGameSnapshot } from "@/lib/reports/postGameSnapshot";

const PreGameReport = dynamic(
  () => import("@/app/reports/components/PreGameReport").then((m) => ({ default: m.PreGameReport })),
  { loading: () => <ReportsTabSkeleton label="Loading pre-game report…" /> }
);
const PostGameReport = dynamic(
  () => import("@/app/reports/components/PostGameReport").then((m) => ({ default: m.PostGameReport })),
  { loading: () => <ReportsTabSkeleton label="Loading post-game report…" /> }
);
const PlayerReportsTab = dynamic(
  () => import("@/app/reports/components/PlayerReportsTab").then((m) => ({ default: m.PlayerReportsTab })),
  { loading: () => <ReportsTabSkeleton label="Loading player reports…" /> }
);
const TeamTrends = dynamic(
  () => import("@/app/reports/components/TeamTrends").then((m) => ({ default: m.TeamTrends })),
  { loading: () => <ReportsTabSkeleton label="Loading team trends…" /> }
);

function ReportsTabSkeleton({ label }: { label: string }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-base text-[var(--text-muted)]"
      aria-busy="true"
      aria-label={label}
    >
      {label}
    </div>
  );
}

function PreGameReportSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8"
      aria-busy="true"
      aria-label="Loading scouting data"
    >
      <div className="h-8 w-2/3 max-w-md rounded bg-[var(--bg-elevated)]" />
      <div className="h-4 w-1/2 max-w-sm rounded bg-[var(--bg-elevated)]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-40 rounded-lg bg-[var(--bg-elevated)]" />
      </div>
      <div className="h-32 rounded-lg bg-[var(--bg-elevated)]" />
    </div>
  );
}

const btnPrimary =
  "font-orbitron inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] shadow-[0_0_12px_rgba(214,186,72,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "font-orbitron inline-flex min-h-[44px] items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

type HubTab = "pregame" | "postgame" | "players" | "trends";

const TAB_META: { id: HubTab; label: string }[] = [
  { id: "pregame", label: "Pre-Game" },
  { id: "postgame", label: "Post-Game" },
  { id: "players", label: "Player Reports" },
  { id: "trends", label: "Team Trends" },
];

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function gameOptionLabel(g: Game) {
  const d = formatDateMMDDYYYY(g.date);
  return `${d} — ${matchupLabelUsFirst(g, true)}`;
}

function postgameAddendumStorageKey(gameId: string): string {
  return `reports-postgame-addendum:${gameId}`;
}

export function ReportsHubClient({
  games,
  batterRoster,
  teamTrendPoints,
  teamTrendInsights,
  canEdit,
}: {
  games: Game[];
  batterRoster: Player[];
  teamTrendPoints: TeamTrendPoint[];
  teamTrendInsights: string[];
  canEdit: boolean;
}) {
  const preGamePdfRef = useRef<HTMLDivElement>(null);
  const postGamePdfRef = useRef<HTMLDivElement>(null);
  const trendsPdfRef = useRef<HTMLDivElement>(null);
  const preGameOverviewCacheRef = useRef<Map<string, PreGameOverviewPayload>>(new Map());
  const batterStatsLoadStartedRef = useRef(false);

  const [tab, setTab] = useState<HubTab>("pregame");
  const [gameId, setGameId] = useState(() => games[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postGameGame, setPostGameGame] = useState<Game | null>(null);
  const [postGameData, setPostGameData] = useState<PostGameSnapshot | null>(null);
  const [postGamePas, setPostGamePas] = useState<PlateAppearance[] | null>(null);
  const [analystAddendum, setAnalystAddendum] = useState("");
  const [preGameOverview, setPreGameOverview] = useState<PreGameOverviewPayload | null>(null);
  const [preGameLoading, setPreGameLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [statsByPlayerId, setStatsByPlayerId] = useState<
    Record<string, BattingStatsWithSplits | undefined>
  >({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => () => unmountCaptureStyles(), []);

  const selectedGame = games.find((g) => g.id === gameId) ?? null;
  const postGameStale = Boolean(postGameGame && gameId && postGameGame.id !== gameId);

  useEffect(() => {
    if (!gameId?.trim()) {
      setAnalystAddendum("");
      return;
    }
    try {
      setAnalystAddendum(localStorage.getItem(postgameAddendumStorageKey(gameId)) ?? "");
    } catch {
      setAnalystAddendum("");
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId?.trim()) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(postgameAddendumStorageKey(gameId), analystAddendum);
      } catch {
        /* ignore quota / private mode */
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [gameId, analystAddendum]);

  useEffect(() => {
    if (tab !== "pregame" && tab !== "players") return;
    if (batterStatsLoadStartedRef.current || batterRoster.length === 0) return;
    batterStatsLoadStartedRef.current = true;
    let cancelled = false;
    setStatsLoading(true);
    void (async () => {
      const res = await fetchReportsBatterStats(batterRoster.map((p) => p.id));
      if (cancelled) return;
      if (!res.ok) {
        setError((prev) => prev ?? res.error);
        setStatsByPlayerId({});
      } else {
        setStatsByPlayerId(res.statsByPlayerId);
      }
      setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, batterRoster]);

  useEffect(() => {
    if (!gameId?.trim()) {
      setPreGameOverview(null);
      setPreGameLoading(false);
      return;
    }

    const cached = preGameOverviewCacheRef.current.get(gameId);
    if (cached) {
      setPreGameOverview(cached);
      setPreGameLoading(false);
      return;
    }

    let cancelled = false;
    setPreGameLoading(true);
    setPreGameOverview(null);
    void (async () => {
      const res = await fetchPreGameOverview(gameId, teamTrendInsights);
      if (cancelled) return;
      if ("error" in res) {
        setPreGameOverview(null);
      } else {
        preGameOverviewCacheRef.current.set(gameId, res);
        setPreGameOverview(res);
      }
      setPreGameLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, teamTrendInsights]);

  const onGenerate = useCallback(async () => {
    if (!gameId?.trim()) {
      setError("Select a game.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReportsGamePayload(gameId);
      if ("error" in res) {
        setError(res.error);
        setPostGameGame(null);
        setPostGameData(null);
        setPostGamePas(null);
        return;
      }
      setPostGameGame(res.game);
      setPostGameData(res.postGame);
      setPostGamePas(res.pas);
      setTab("postgame");
    } catch {
      setError("Could not load report.");
      setPostGameGame(null);
      setPostGameData(null);
      setPostGamePas(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const onExportPdf = useCallback(async () => {
    if (tab === "pregame") {
      if (!selectedGame) {
        setError("Select a game.");
        return;
      }
      if (preGameLoading || !preGameOverview) {
        setError("Pre-game report is still loading — try again in a moment.");
        return;
      }
      const root = preGamePdfRef.current;
      if (!root) {
        setError("Pre-game report is not ready to export.");
        return;
      }
      setError(null);
      flushSync(() => setExportingPdf(true));
      await waitForNextPaint();
      try {
        await downloadPreGameReportPdf(root, selectedGame);
      } catch (err) {
        const detail = err instanceof Error ? err.message : null;
        setError(detail ? `Could not build pre-game PDF: ${detail}` : "Could not build pre-game PDF.");
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    if (tab === "postgame") {
      if (!postGameGame || !postGameData || !postGamePas) {
        setError("Generate the post-game report first.");
        return;
      }
      if (postGameStale) {
        setError("Selected game changed — tap Generate Report to refresh the post-game snapshot.");
        return;
      }
      const root = postGamePdfRef.current;
      if (!root) {
        setError("Post-game report is not ready to export.");
        return;
      }
      setError(null);
      flushSync(() => setExportingPdf(true));
      await waitForNextPaint();
      try {
        await downloadPostGameReportPdf(root, postGameGame);
      } catch (err) {
        const detail = err instanceof Error ? err.message : null;
        setError(detail ? `Could not build post-game PDF: ${detail}` : "Could not build post-game PDF.");
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    if (tab === "trends") {
      const root = trendsPdfRef.current;
      if (!root) {
        setError("Team trends are not ready to export.");
        return;
      }
      setError(null);
      flushSync(() => setExportingPdf(true));
      await waitForNextPaint();
      try {
        await downloadTeamTrendsReportPdf(root);
      } catch (err) {
        const detail = err instanceof Error ? err.message : null;
        setError(detail ? `Could not build team trends PDF: ${detail}` : "Could not build team trends PDF.");
      } finally {
        setExportingPdf(false);
      }
    }
  }, [
    tab,
    selectedGame,
    preGameLoading,
    preGameOverview,
    postGameGame,
    postGameData,
    postGamePas,
    postGameStale,
  ]);

  const exportDisabled =
    loading ||
    exportingPdf ||
    (tab === "pregame" && (preGameLoading || !preGameOverview)) ||
    (tab === "postgame" && (!postGameGame || !postGameData || postGameStale));

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-orbitron text-3xl font-semibold tracking-tight text-[var(--text)]">Reports</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Pre-game, post-game, player profiles, and team trends export as PDF (download + new tab).
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-h-[44px] flex-col text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:min-w-[220px]">
            Select game
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm font-normal text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
              disabled={games.length === 0}
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
          </label>
          <button type="button" className={btnPrimary} onClick={() => void onGenerate()} disabled={loading || !canEdit}>
            {loading ? "Generating…" : "Generate Report"}
          </button>
          {tab !== "players" ? (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void onExportPdf()}
              disabled={exportDisabled}
            >
              {exportingPdf ? "Building PDF…" : "Export PDF"}
            </button>
          ) : null}
        </div>
      </header>

      {!canEdit && (
        <div
          className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]"
          style={{ background: "var(--warning-dim)" }}
        >
          Connect Supabase to load live games and generate reports.
        </div>
      )}

      {error ? (
        <div
          className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {postGameStale ? (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          The selected game changed. Tap <span className="font-semibold">Generate Report</span> to refresh the
          post-game snapshot before exporting.
        </div>
      ) : null}

      <nav
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Report sections"
      >
        {TAB_META.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`font-orbitron min-h-[44px] shrink-0 rounded-lg border-2 px-4 py-2 text-sm font-semibold tracking-wide transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_16px_rgba(214,186,72,0.2)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/45 hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div className="reports-print-area space-y-6">
        <div key={tab} className="reports-tab-enter">
          {tab === "pregame" && (
            <>
              {selectedGame ? (
                preGameLoading && !preGameOverview ? (
                  <PreGameReportSkeleton />
                ) : (
                  <PreGameReport
                    captureRef={preGamePdfRef}
                    pdfCapture={exportingPdf}
                    game={selectedGame}
                    roster={batterRoster}
                    statsByPlayerId={statsByPlayerId}
                    overview={preGameOverview}
                  />
                )
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-base text-[var(--text-muted)]">
                  Add a game on the schedule, then pick it above to load the pre-game PDF preview.
                </p>
              )}
            </>
          )}
          {tab === "postgame" && (
            <>
              {postGameGame && postGameData && postGamePas ? (
                <PostGameReport
                  captureRef={postGamePdfRef}
                  pdfCapture={exportingPdf}
                  game={postGameGame}
                  data={postGameData}
                  pas={postGamePas}
                  analystAddendum={analystAddendum}
                  onAnalystAddendumChange={setAnalystAddendum}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-base leading-relaxed text-[var(--text-muted)]">
                  Choose a game above and tap{" "}
                  <span className="font-semibold text-[var(--accent)]">Generate Report</span> to load plate appearances
                  and build the post-game snapshot.
                </p>
              )}
            </>
          )}
          {tab === "players" && (
            <PlayerReportsTab
              roster={batterRoster}
              statsByPlayerId={statsByPlayerId}
              statsLoading={statsLoading}
            />
          )}
          {tab === "trends" && (
            <TeamTrends
              captureRef={trendsPdfRef}
              pdfCapture={exportingPdf}
              points={teamTrendPoints}
              insights={teamTrendInsights}
            />
          )}
        </div>
      </div>
    </div>
  );
}
