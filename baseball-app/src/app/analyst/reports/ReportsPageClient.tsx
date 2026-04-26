"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchCoachPacketAction, fetchHitterReportBundleAction } from "./actions";
import { downloadCoachPacketPdf } from "@/lib/reports/coachPacketPdf";
import { downloadHitterReportPdf } from "@/lib/reports/playerReportPdf";
import { formatDateMMDDYYYY } from "@/lib/format";
import { isPitcherPlayer, matchupLabelUsFirst } from "@/lib/opponentUtils";
import type { CoachPacketModel } from "@/lib/reports/coachPacketTypes";
import type { Game, Player } from "@/lib/types";
import { analystComparePlayersHref, analystGameLogHref } from "@/lib/analystRoutes";

const btnPrimary =
  "font-display inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "font-display inline-flex min-h-[44px] items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

const tabBtn =
  "font-display min-h-[44px] flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm font-semibold tracking-wide transition sm:flex-none sm:px-5";
const tabActive =
  "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]";
const tabIdle =
  "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]";

const MAX_PLAYER_PICK = 5;

type ReportTab = "game" | "batter" | "pitcher";

function PdfOutlineCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-4">
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{title}</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-[var(--text-muted)]">{children}</ul>
    </div>
  );
}

export function ReportsPageClient({
  games,
  roster,
  canEdit,
}: {
  games: Game[];
  roster: Player[];
  canEdit: boolean;
}) {
  const batters = useMemo(
    () => [...roster].filter((p) => !isPitcherPlayer(p)).sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );
  const pitchers = useMemo(
    () => [...roster].filter(isPitcherPlayer).sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );

  const [tab, setTab] = useState<ReportTab>(() => (games.length > 0 ? "game" : batters.length > 0 ? "batter" : "pitcher"));

  const [gameId, setGameId] = useState<string>(() => games[0]?.id ?? "");
  const [loadingGame, setLoadingGame] = useState(false);
  const [errorGame, setErrorGame] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [compareTwo, setCompareTwo] = useState(false);
  const [loadingPlayerPdf, setLoadingPlayerPdf] = useState(false);
  const [errorPlayerPdf, setErrorPlayerPdf] = useState<string | null>(null);

  const pool = tab === "batter" ? batters : tab === "pitcher" ? pitchers : [];

  useEffect(() => {
    setSelectedIds(new Set());
    setCompareTwo(false);
    setErrorPlayerPdf(null);
  }, [tab]);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PLAYER_PICK) next.add(id);
      return next;
    });
  };

  const loadPacket = useCallback(async (): Promise<CoachPacketModel | null> => {
    if (!gameId) {
      setErrorGame("Select a game.");
      return null;
    }
    setLoadingGame(true);
    setErrorGame(null);
    try {
      const res = await fetchCoachPacketAction(gameId);
      if ("error" in res) {
        setErrorGame(res.error);
        return null;
      }
      return res;
    } catch {
      setErrorGame("Could not load report data.");
      return null;
    } finally {
      setLoadingGame(false);
    }
  }, [gameId]);

  const onGamePdf = async () => {
    const m = await loadPacket();
    if (!m) return;
    downloadCoachPacketPdf(m);
  };

  const playerPdfDisabled =
    tab === "game" ||
    loadingPlayerPdf ||
    selectedIds.size === 0 ||
    (compareTwo && selectedIds.size !== 2);

  const onPlayerPdf = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setErrorPlayerPdf("Select at least one player.");
      return;
    }
    if (compareTwo && ids.length !== 2) {
      setErrorPlayerPdf('Select exactly two players for comparison, or turn off "Compare two".');
      return;
    }
    setLoadingPlayerPdf(true);
    setErrorPlayerPdf(null);
    try {
      const res = await fetchHitterReportBundleAction(ids);
      if ("error" in res) {
        setErrorPlayerPdf(res.error);
        return;
      }
      downloadHitterReportPdf(res, { compare: compareTwo && ids.length === 2 });
    } catch {
      setErrorPlayerPdf("Could not build PDF.");
    } finally {
      setLoadingPlayerPdf(false);
    }
  };

  const selectedArr = pool.filter((p) => selectedIds.has(p.id));
  const compareHref =
    tab !== "game" && selectedArr.length === 2
      ? analystComparePlayersHref({ p1: selectedArr[0].id, p2: selectedArr[1].id })
      : null;

  const downloadLabel =
    tab === "batter"
      ? compareTwo && selectedIds.size === 2
        ? "Download batter comparison PDF"
        : "Download batter PDF"
      : tab === "pitcher"
        ? compareTwo && selectedIds.size === 2
          ? "Download pitcher comparison PDF"
          : "Download pitcher PDF"
        : "Download";

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Reports</h1>
        <p className="max-w-2xl text-sm text-[var(--text-muted)]">
          Choose what you need for coaches: a full game packet, or focused batter / pitcher PDFs built from logged
          stats.
        </p>
      </header>

      {!canEdit && (
        <div
          className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]"
          style={{ background: "var(--warning-dim)" }}
        >
          Connect Supabase to load live games and export reports.
        </div>
      )}

      <nav
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch"
        aria-label="Report type"
      >
        {games.length > 0 && (
          <button
            type="button"
            className={`${tabBtn} ${tab === "game" ? tabActive : tabIdle}`}
            onClick={() => setTab("game")}
            aria-pressed={tab === "game"}
          >
            Game packet
          </button>
        )}
        <button
          type="button"
          className={`${tabBtn} ${tab === "batter" ? tabActive : tabIdle}`}
          onClick={() => setTab("batter")}
          aria-pressed={tab === "batter"}
        >
          Batter report
        </button>
        <button
          type="button"
          className={`${tabBtn} ${tab === "pitcher" ? tabActive : tabIdle}`}
          onClick={() => setTab("pitcher")}
          aria-pressed={tab === "pitcher"}
        >
          Pitcher report
        </button>
      </nav>

      {tab === "game" && games.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,320px)] lg:items-start">
          <section className="card-tech space-y-4 rounded-lg border border-[var(--border)] p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Build game packet</h2>
            <p className="text-sm text-[var(--text-muted)]">
              One PDF for a single game — good for the dugout or a pregame printout.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[min(100%,280px)] flex-col gap-1 text-sm">
                <span className="font-medium text-[var(--text-muted)]">Game</span>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                >
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {formatDateMMDDYYYY(g.date)} — {matchupLabelUsFirst(g, true)}
                    </option>
                  ))}
                </select>
              </label>
              {gameId ? (
                <Link href={analystGameLogHref(gameId)} className={`${btnSecondary} sm:mb-0.5`}>
                  Open log
                </Link>
              ) : null}
            </div>
            {errorGame && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {errorGame}
              </p>
            )}
            <button
              type="button"
              className={`${btnPrimary} w-fit`}
              disabled={loadingGame || !gameId}
              onClick={onGamePdf}
            >
              {loadingGame ? "Building…" : "Download PDF"}
            </button>
          </section>
          <PdfOutlineCard title="This PDF includes">
            <li>Single redesigned first page (lineup card format).</li>
            <li>Header with teams shown as our team vs opponent, plus Home/Away.</li>
            <li>Two-column lineup layout (our lineup + opponent lineup).</li>
            <li>Each hitter row shows season AVG and OPS next to the name.</li>
            <li>Jersey number and position listed beneath each hitter name.</li>
          </PdfOutlineCard>
        </div>
      )}

      {tab === "game" && games.length === 0 && canEdit && (
        <p className="text-sm text-[var(--text-muted)]">
          No games yet — add one under{" "}
          <Link href="/analyst/games" className="font-medium text-[var(--accent)] hover:underline">
            Games
          </Link>{" "}
          to use the game packet tab.
        </p>
      )}

      {tab === "batter" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,340px)] lg:items-start">
          <section className="card-tech space-y-4 rounded-lg border border-[var(--border)] p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Select batters</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Roster players who do <strong className="font-medium text-[var(--text)]">not</strong> have position{" "}
              <strong className="font-medium text-[var(--text)]">P</strong> on their profile. Anyone with P only
              appears under <strong className="font-medium text-[var(--text)]">Pitcher report</strong>.
            </p>

            {batters.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No batters on the club roster match that rule.</p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40 p-2">
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {batters.map((p) => {
                      const checked = selectedIds.has(p.id);
                      const disabled = !checked && selectedIds.size >= MAX_PLAYER_PICK;
                      return (
                        <li key={p.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition hover:bg-[var(--bg-card)] ${
                              disabled ? "cursor-not-allowed opacity-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => togglePlayer(p.id)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                            <span className="text-[var(--text)]">
                              {p.name}
                              {p.jersey ? (
                                <span className="text-[var(--text-muted)]"> #{p.jersey}</span>
                              ) : null}
                              {p.bats ? (
                                <span className="text-[var(--text-muted)]"> · {p.bats}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Up to {MAX_PLAYER_PICK} batters per PDF.</p>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={compareTwo}
                    onChange={(e) => setCompareTwo(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span>
                    <strong className="font-medium">Compare two batters</strong> — one combined splits table, then
                    each player&apos;s spray section (pick exactly two).
                  </span>
                </label>

                {compareHref ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    <Link href={compareHref} className="font-medium text-[var(--accent)] hover:underline">
                      Open this pair in Compare players
                    </Link>{" "}
                    for full-screen charts.
                  </p>
                ) : null}

                {compareTwo && selectedIds.size !== 2 ? (
                  <p className="text-xs text-[var(--warning)]">Pick exactly two batters to enable comparison PDF.</p>
                ) : null}

                {errorPlayerPdf && (
                  <p className="text-sm text-[var(--danger)]" role="alert">
                    {errorPlayerPdf}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={playerPdfDisabled}
                    onClick={onPlayerPdf}
                  >
                    {loadingPlayerPdf ? "Building…" : downloadLabel}
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </button>
                </div>
              </>
            )}
          </section>
          <PdfOutlineCard title="Batter PDF includes">
            <li>
              <strong className="font-medium text-[var(--text)]">Batting splits</strong> — Overall, vs LHP, vs RHP,
              RISP: PA, AB, H, AVG, OBP, SLG, OPS.
            </li>
            <li>
              <strong className="font-medium text-[var(--text)]">Spray tables</strong> — Pull / middle / oppo counts on
              logged balls in play, split by pitcher hand (same data as profile spray charts, as numbers).
            </li>
            <li>Multiple batters: one block per player in order.</li>
            <li>Compare two: shared splits columns, then spray for batter A and batter B.</li>
          </PdfOutlineCard>
        </div>
      )}

      {tab === "pitcher" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,340px)] lg:items-start">
          <section className="card-tech space-y-4 rounded-lg border border-[var(--border)] p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Select pitchers</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Roster players whose positions include <strong className="font-medium text-[var(--text)]">P</strong>.
              The PDF emphasizes <strong className="font-medium text-[var(--text)]">BIP allowed</strong> by batter
              side (LHB / RHB); batting splits show their rare PA as a hitter, if any.
            </p>

            {pitchers.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No pitchers on the club roster (add P to a player).</p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40 p-2">
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {pitchers.map((p) => {
                      const checked = selectedIds.has(p.id);
                      const disabled = !checked && selectedIds.size >= MAX_PLAYER_PICK;
                      return (
                        <li key={p.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition hover:bg-[var(--bg-card)] ${
                              disabled ? "cursor-not-allowed opacity-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => togglePlayer(p.id)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                            <span className="text-[var(--text)]">
                              {p.name}
                              {p.jersey ? (
                                <span className="text-[var(--text-muted)]"> #{p.jersey}</span>
                              ) : null}
                              {p.throws ? (
                                <span className="text-[var(--text-muted)]"> · throws {p.throws}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Up to {MAX_PLAYER_PICK} pitchers per PDF.</p>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={compareTwo}
                    onChange={(e) => setCompareTwo(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span>
                    <strong className="font-medium">Compare two pitchers</strong> — same layout as batters: combined
                    splits, then each arm&apos;s spray section (pick exactly two).
                  </span>
                </label>

                {compareHref ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    <Link href={compareHref} className="font-medium text-[var(--accent)] hover:underline">
                      Open this pair in Compare players
                    </Link>
                    .
                  </p>
                ) : null}

                {compareTwo && selectedIds.size !== 2 ? (
                  <p className="text-xs text-[var(--warning)]">Pick exactly two pitchers to enable comparison PDF.</p>
                ) : null}

                {errorPlayerPdf && (
                  <p className="text-sm text-[var(--danger)]" role="alert">
                    {errorPlayerPdf}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={playerPdfDisabled}
                    onClick={onPlayerPdf}
                  >
                    {loadingPlayerPdf ? "Building…" : downloadLabel}
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </button>
                </div>
              </>
            )}
          </section>
          <PdfOutlineCard title="Pitcher PDF includes">
            <li>
              <strong className="font-medium text-[var(--text)]">Batting splits</strong> — Hitting stats for that player
              (often few PA); same table shape as hitters.
            </li>
            <li>
              <strong className="font-medium text-[var(--text)]">Spray as pitcher</strong> — BIP they allowed, broken
              out vs <strong className="font-medium text-[var(--text)]">LHB</strong> and{" "}
              <strong className="font-medium text-[var(--text)]">RHB</strong>, with pull/middle/oppo counts and mix %.
            </li>
            <li>Multiple pitchers: one block per player.</li>
            <li>Compare two: shared table + spray for each arm.</li>
          </PdfOutlineCard>
        </div>
      )}

      {roster.length === 0 && (
        <div className="card-tech rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          No club roster players. Add players under Roster to use batter and pitcher reports.
        </div>
      )}
    </div>
  );
}
