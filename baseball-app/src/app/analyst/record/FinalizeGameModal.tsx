"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { totalRunsBottom, totalRunsTop } from "@/lib/compute/boxScore";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { winningSideFromRuns, pitcherIdsForTeamSide } from "@/lib/gameRecord";
import type { Game, PlateAppearance, Player } from "@/lib/types";

const digitalGlow = {
  textShadow:
    "0 0 6px rgba(57, 255, 100, 1), 0 0 20px rgba(34, 255, 140, 0.55), 0 0 38px rgba(0, 255, 180, 0.28)",
} as const;

/** Classic scoreboard strip: bold white team name, neon green digital readout; en dash between scores. */
function RetroFinalScoreStrip({
  awayName,
  homeName,
  awayRuns,
  homeRuns,
}: {
  awayName: string;
  homeName: string;
  awayRuns: number;
  homeRuns: number;
}) {
  const stripeBg =
    "repeating-linear-gradient(180deg, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px)";

  const teamNameClass =
    "mb-2 max-w-full truncate px-1 text-center text-sm font-black uppercase leading-tight tracking-wide text-white sm:text-base";

  const digitClass =
    "text-center text-4xl font-extrabold tabular-nums leading-none tracking-[0.12em] text-[#39ff14] sm:text-5xl [font-family:var(--font-orbitron)]";

  const scoreCell = (runs: number) => (
    <div className="w-full max-w-[9rem] justify-self-center rounded-md border border-zinc-700/90 bg-zinc-900/90 px-3 py-3 shadow-[inset_0_4px_14px_rgba(0,0,0,0.9)]">
      <p className={digitClass} style={digitalGlow}>
        {runs}
      </p>
    </div>
  );

  return (
    <div
      className="rounded-lg border-2 border-zinc-600 bg-black p-4 sm:p-5"
      style={{ backgroundImage: stripeBg }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-x-2 sm:gap-x-4">
        <p
          className={`col-start-1 row-start-1 ${teamNameClass}`}
          style={{
            fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Franklin Gothic Bold', sans-serif",
          }}
          title={awayName}
        >
          {awayName}
        </p>
        <p
          className={`col-start-3 row-start-1 ${teamNameClass}`}
          style={{
            fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Franklin Gothic Bold', sans-serif",
          }}
          title={homeName}
        >
          {homeName}
        </p>
        <div className="col-start-1 row-start-2">{scoreCell(awayRuns)}</div>
        <div className="col-start-2 row-start-2 flex min-h-[3.25rem] items-center justify-center px-0.5 sm:min-h-[3.75rem]">
          <span className={`${digitClass} pb-0.5`} style={digitalGlow} aria-hidden>
            –
          </span>
        </div>
        <div className="col-start-3 row-start-2">{scoreCell(homeRuns)}</div>
      </div>
    </div>
  );
}

export function FinalizeGameModal({
  open,
  onClose,
  game,
  pas,
  players,
  finalHomeRuns,
  finalAwayRuns,
  initialWinningPitcherId,
  initialSavePitcherId,
  initialLosingPitcherId,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  game: Game;
  pas: PlateAppearance[];
  players: Player[];
  finalHomeRuns: number;
  finalAwayRuns: number;
  initialWinningPitcherId?: string | null;
  initialSavePitcherId?: string | null;
  initialLosingPitcherId?: string | null;
  pending: boolean;
  onConfirm: (
    winningPitcherId: string | null,
    savePitcherId: string | null,
    losingPitcherId: string | null
  ) => void | Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const [winningId, setWinningId] = useState<string>("");
  const [saveId, setSaveId] = useState<string>("");
  const [losingId, setLosingId] = useState<string>("");

  const gamePas = useMemo(() => pas.filter((p) => p.game_id === game.id), [pas, game.id]);
  const runsFromPasAway = useMemo(() => totalRunsTop(gamePas), [gamePas]);
  const runsFromPasHome = useMemo(() => totalRunsBottom(gamePas), [gamePas]);
  const runTotalsMismatch =
    finalAwayRuns !== runsFromPasAway || finalHomeRuns !== runsFromPasHome;
  const pasMissingHalfCount = useMemo(
    () => gamePas.filter((p) => p.inning_half !== "top" && p.inning_half !== "bottom").length,
    [gamePas]
  );
  const pasMissingHalfWarn = pasMissingHalfCount > 0;

  const winningSide = winningSideFromRuns(finalHomeRuns, finalAwayRuns);
  const losingSide =
    winningSide === "home" ? "away" : winningSide === "away" ? "home" : null;

  const candidatePitcherIds = useMemo(() => {
    if (!winningSide) return [];
    return pitcherIdsForTeamSide(game, pas, winningSide);
  }, [game, pas, winningSide]);

  const losingCandidatePitcherIds = useMemo(() => {
    if (!losingSide) return [];
    return pitcherIdsForTeamSide(game, pas, losingSide);
  }, [game, pas, losingSide]);

  const byPlayerId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const pitcherOptions = useMemo(() => {
    const list = candidatePitcherIds.map((id) => byPlayerId.get(id)).filter((p): p is Player => p != null);
    return [...list].sort(comparePlayersByLastNameThenFull);
  }, [byPlayerId, candidatePitcherIds]);

  const losingPitcherOptions = useMemo(() => {
    const list = losingCandidatePitcherIds.map((id) => byPlayerId.get(id)).filter((p): p is Player => p != null);
    return [...list].sort(comparePlayersByLastNameThenFull);
  }, [byPlayerId, losingCandidatePitcherIds]);

  const winningTeamName = winningSide === "home" ? game.home_team : winningSide === "away" ? game.away_team : null;
  const losingTeamName = losingSide === "home" ? game.home_team : losingSide === "away" ? game.away_team : null;

  useEffect(() => {
    if (!open) return;
    setWinningId(initialWinningPitcherId?.trim() ?? "");
    setSaveId(initialSavePitcherId?.trim() ?? "");
    setLosingId(initialLosingPitcherId?.trim() ?? "");
  }, [open, initialWinningPitcherId, initialSavePitcherId, initialLosingPitcherId]);

  const samePitcherError = Boolean(winningId && saveId && winningId === saveId);
  const winningLosingSameError = Boolean(winningId && losingId && winningId === losingId);

  if (!open) return null;

  const canSubmit = winningSide != null && !samePitcherError && !winningLosingSameError;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl ring-1 ring-[var(--accent)]/15"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="font-display text-lg font-semibold text-[var(--text)]">
          Finalize game
        </h3>
        <p id={descId} className="sr-only">
          Final score {finalAwayRuns} to {finalHomeRuns}, visitor to home.
          {winningTeamName ? ` Winner: ${winningTeamName}.` : " Game is tied; finalize is disabled."}
        </p>

        <div className="mt-3 space-y-2">
          <RetroFinalScoreStrip
            awayName={game.away_team}
            homeName={game.home_team}
            awayRuns={finalAwayRuns}
            homeRuns={finalHomeRuns}
          />
          {winningTeamName ? (
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Winner · <span className="text-[var(--text)]">{winningTeamName}</span>
            </p>
          ) : (
            <p className="text-center text-sm text-[var(--text-muted)]">
              Tied game — adjust recorded runs or PAs before finalizing.
            </p>
          )}
        </div>

        {(runTotalsMismatch || pasMissingHalfWarn) && (
          <div className="mt-3 space-y-2">
            {runTotalsMismatch ? (
              <div
                className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                role="status"
              >
                <p className="font-semibold text-amber-200">Runs don’t match plate appearances</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
                  Final totals here are{" "}
                  <span className="tabular-nums font-medium">
                    {finalAwayRuns}–{finalHomeRuns}
                  </span>{" "}
                  (visitor–home), but runs summed from logged PAs (with inning half top/bottom) are{" "}
                  <span className="tabular-nums font-medium">
                    {runsFromPasAway}–{runsFromPasHome}
                  </span>
                  . Fix missing runs on PAs, R/ER credits, or inning half before relying on the database score.
                </p>
              </div>
            ) : null}
            {pasMissingHalfWarn ? (
              <div
                className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                role="status"
              >
                <p className="font-semibold text-amber-200">Some PAs missing inning half</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
                  {pasMissingHalfCount} plate appearance{pasMissingHalfCount === 1 ? "" : "s"}{" "}
                  {pasMissingHalfCount === 1 ? "has" : "have"} no top/bottom half set. Linescore-style checks and
                  pitcher-side detection may be wrong until those rows are corrected in Log.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {winningSide != null ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Winning pitcher
              </span>
              <select
                value={winningId}
                onChange={(e) => setWinningId(e.target.value)}
                disabled={pending || pitcherOptions.length === 0}
                className="input-tech mt-1 block w-full px-3 py-2"
                aria-label="Winning pitcher"
              >
                <option value="">—</option>
                {pitcherOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey ? ` #${p.jersey}` : ""}
                  </option>
                ))}
              </select>
              {pitcherOptions.length === 0 ? (
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  No pitchers found for {winningTeamName} in this game (add PAs with inning half, or set a starting
                  pitcher on the game).
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Save pitcher
              </span>
              <select
                value={saveId}
                onChange={(e) => setSaveId(e.target.value)}
                disabled={pending || pitcherOptions.length === 0}
                className="input-tech mt-1 block w-full px-3 py-2"
                aria-label="Save pitcher"
              >
                <option value="">—</option>
                {pitcherOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey ? ` #${p.jersey}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Losing pitcher
                {losingTeamName ? (
                  <span className="font-normal normal-case text-[var(--text-muted)]"> · {losingTeamName}</span>
                ) : null}
              </span>
              <select
                value={losingId}
                onChange={(e) => setLosingId(e.target.value)}
                disabled={pending || losingPitcherOptions.length === 0}
                className="input-tech mt-1 block w-full px-3 py-2"
                aria-label="Losing pitcher"
              >
                <option value="">—</option>
                {losingPitcherOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey ? ` #${p.jersey}` : ""}
                  </option>
                ))}
              </select>
              {losingPitcherOptions.length === 0 ? (
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  No pitchers found for {losingTeamName ?? "the losing team"} (add PAs with inning half, or set a
                  starting pitcher).
                </span>
              ) : null}
            </label>

            {samePitcherError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                Save pitcher cannot be the same as the winning pitcher.
              </p>
            ) : null}
            {winningLosingSameError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                Losing pitcher cannot be the same as the winning pitcher.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => !pending && onClose()}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !canSubmit}
            onClick={() =>
              void onConfirm(winningId.trim() || null, saveId.trim() || null, losingId.trim() || null)
            }
            className="rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)]/15 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Finalizing…" : "Finalize & open review"}
          </button>
        </div>
      </div>
    </div>
  );
}
