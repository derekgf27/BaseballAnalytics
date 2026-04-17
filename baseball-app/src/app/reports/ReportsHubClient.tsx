"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchPreGameOverview,
  fetchReportsGamePayload,
  type PreGameOverviewPayload,
} from "@/app/reports/actions";
import { PostGameReport } from "@/app/reports/components/PostGameReport";
import { PreGameReport } from "@/app/reports/components/PreGameReport";
import { PlayerReportsTab } from "@/app/reports/components/PlayerReportsTab";
import { PlayersToWatch } from "@/app/reports/components/PlayersToWatch";
import { TeamTrends } from "@/app/reports/components/TeamTrends";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { TeamTrendPoint } from "@/lib/reports/teamTrendsSnapshot";
import type { BattingStatsWithSplits, Game, Player } from "@/lib/types";
import type { PostGameSnapshot } from "@/lib/reports/postGameSnapshot";

const btnPrimary =
  "font-orbitron inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] shadow-[0_0_12px_rgba(214,186,72,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "font-orbitron inline-flex min-h-[44px] items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

type HubTab = "pregame" | "postgame" | "players" | "watch" | "trends";

const TAB_META: { id: HubTab; label: string }[] = [
  { id: "pregame", label: "Pre-Game" },
  { id: "postgame", label: "Post-Game" },
  { id: "players", label: "Player Reports" },
  { id: "watch", label: "Players to Watch" },
  { id: "trends", label: "Team Trends" },
];

const PRINT_PAGE_STYLE = `
  @page { size: auto; margin: 14mm; }
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

function gameOptionLabel(g: Game) {
  const d = formatDateMMDDYYYY(g.date);
  return `${d} — ${g.away_team} @ ${g.home_team}`;
}

export function ReportsHubClient({
  games,
  batterRoster,
  statsByPlayerId,
  teamTrendPoints,
  teamTrendInsights,
  canEdit,
}: {
  games: Game[];
  batterRoster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
  teamTrendPoints: TeamTrendPoint[];
  teamTrendInsights: string[];
  canEdit: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<HubTab>("pregame");
  const [gameId, setGameId] = useState(() => games[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postGameGame, setPostGameGame] = useState<Game | null>(null);
  const [postGameData, setPostGameData] = useState<PostGameSnapshot | null>(null);
  const [analystAddendum, setAnalystAddendum] = useState("");
  const [preGameOverview, setPreGameOverview] = useState<PreGameOverviewPayload | null>(null);

  const selectedGame = games.find((g) => g.id === gameId) ?? null;

  useEffect(() => {
    if (!gameId?.trim()) {
      setPreGameOverview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchPreGameOverview(gameId);
      if (cancelled) return;
      if ("error" in res) setPreGameOverview(null);
      else setPreGameOverview(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const documentTitle = useCallback((): string => {
    const tlab = TAB_META.find((t) => t.id === tab)?.label ?? "Reports";
    const g = tab === "postgame" ? postGameGame : selectedGame;
    const gameBit = g ? ` — ${g.away_team} @ ${g.home_team}` : "";
    return `Reports — ${tlab}${gameBit}`;
  }, [tab, postGameGame, selectedGame]);

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle,
    pageStyle: PRINT_PAGE_STYLE,
  });

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
        return;
      }
      setPostGameGame(res.game);
      setPostGameData(res.postGame);
      setTab("postgame");
    } catch {
      setError("Could not load report.");
      setPostGameGame(null);
      setPostGameData(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-orbitron text-3xl font-semibold tracking-tight text-[var(--text)]">Reports</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Pre-game prep and post-game snapshots built from logged data—built for quick coach huddles.
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
          <button type="button" className={btnSecondary} onClick={() => void triggerPrint()} disabled={loading}>
            Export PDF
          </button>
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
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</div>
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

      <div ref={printRef} className="reports-print-area space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "pregame" && (
              <>
                {selectedGame ? (
                  <PreGameReport
                    game={selectedGame}
                    roster={batterRoster}
                    statsByPlayerId={statsByPlayerId}
                    trendInsights={teamTrendInsights}
                    overview={preGameOverview}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-base text-[var(--text-muted)]">
                    Add a game on the schedule, then pick it above to see matchup context and season leaders.
                  </p>
                )}
              </>
            )}
            {tab === "postgame" && (
              <>
                {postGameGame && postGameData ? (
                  <PostGameReport
                    game={postGameGame}
                    data={postGameData}
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
              <PlayerReportsTab roster={batterRoster} statsByPlayerId={statsByPlayerId} />
            )}
            {tab === "watch" && (
              <PlayersToWatch roster={batterRoster} statsByPlayerId={statsByPlayerId} />
            )}
            {tab === "trends" && <TeamTrends points={teamTrendPoints} insights={teamTrendInsights} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
