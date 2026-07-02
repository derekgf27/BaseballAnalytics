"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatDateMMDDYYYY } from "@/lib/format";
import { todayIsoDate } from "@/lib/coachGamePick";
import { opponentTeamName, ourVenueLabel } from "@/lib/opponentUtils";
import type { Game } from "@/lib/types";

function featuredGameHeading(game: Game, today: string): string {
  if (game.date === today) return "Tonight's game";
  if (game.date > today) return "Next game";
  return "Recent game";
}

function gameHasStartedSession(game: Game): boolean {
  return Boolean(game.pitch_tracker_group_id?.trim());
}

function PitchPadGameCard({
  game,
  onSelect,
  disabled,
  featured = false,
}: {
  game: Game;
  onSelect: (gameId: string) => void;
  disabled: boolean;
  featured?: boolean;
}) {
  const opponent = opponentTeamName(game);
  const venue = ourVenueLabel(game);
  const sessionStarted = gameHasStartedSession(game);

  if (featured) {
    const today = todayIsoDate();
    return (
      <div className="pitch-pad-game-card-featured rounded-2xl border p-5 shadow-lg">
        <p className="pitch-pad-accent text-xs font-semibold uppercase tracking-wider">
          {featuredGameHeading(game, today)} · {venue}
        </p>
        <p className="mt-2 font-orbitron text-2xl font-bold tracking-tight text-[var(--text)]">
          vs {opponent}
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{formatDateMMDDYYYY(game.date)}</p>
        {sessionStarted ? (
          <p className="mt-2 text-xs font-medium text-[var(--warning)]">
            Session started — tap to resume
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(game.id)}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white transition hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open pitch pad
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(game.id)}
      className="pitch-pad-game-card w-full rounded-xl border px-4 py-4 text-left transition hover:border-emerald-600/50 hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-input)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          {venue}
        </span>
        {sessionStarted ? (
          <span className="shrink-0 rounded-full bg-[var(--warning-dim)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
            In progress
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-lg font-semibold text-[var(--text)]">vs {opponent}</p>
      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{formatDateMMDDYYYY(game.date)}</p>
    </button>
  );
}

export function PitchPadGamePicker({
  games,
  gamesLoading,
  featuredGame,
  otherGames,
  resolveError,
  resolving,
  onSelectGame,
}: {
  games: Game[];
  gamesLoading: boolean;
  featuredGame: Game | null;
  otherGames: Game[];
  resolveError: string | null;
  resolving: boolean;
  onSelectGame: (gameId: string) => void;
}) {
  const [otherExpanded, setOtherExpanded] = useState(false);
  const showOtherSection = otherGames.length > 0;
  const singleGame = games.length === 1 && featuredGame;

  return (
    <div className="coach-pitch-pad flex min-h-[100dvh] flex-col bg-[var(--bg-base)] px-4 py-8 text-[var(--text)]">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/coach"
            className="pitch-pad-btn-secondary touch-manipulation inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition active:opacity-90"
            aria-label="Back to coach home"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            <span>Coach home</span>
          </Link>
          <ThemeToggle variant="icon" className="!h-11 !w-11 shrink-0" />
        </div>

        <div>
          <h1 className="font-orbitron text-2xl font-bold tracking-tight">Pitch pad</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Pick tonight&apos;s game to start tracking pitches. Batter, count, and outs update live with the
            scorekeeper.
          </p>
        </div>

        {resolveError ? (
          <p
            className="pitch-pad-banner-error rounded-lg border border-[var(--danger)]/40 px-3 py-2 text-sm"
            role="alert"
          >
            {resolveError}
          </p>
        ) : null}

        {gamesLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading games">
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--bg-card)]" />
            <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
          </div>
        ) : games.length === 0 ? (
          <div className="pitch-pad-surface rounded-xl border px-4 py-6 text-center">
            <p className="text-sm font-medium text-[var(--text)]">No active games yet</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Ask your analyst to create today&apos;s game in Analyst → Games, then come back here to open the
              pitch pad.
            </p>
          </div>
        ) : singleGame && featuredGame ? (
          <PitchPadGameCard
            game={featuredGame}
            onSelect={onSelectGame}
            disabled={resolving}
            featured
          />
        ) : (
          <div className="space-y-4">
            {featuredGame ? (
              <PitchPadGameCard
                game={featuredGame}
                onSelect={onSelectGame}
                disabled={resolving}
                featured
              />
            ) : null}

            {showOtherSection ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setOtherExpanded((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                  aria-expanded={otherExpanded}
                >
                  <span>Other games ({otherGames.length})</span>
                  <span className="text-base leading-none" aria-hidden>
                    {otherExpanded ? "▾" : "▸"}
                  </span>
                </button>
                {otherExpanded ? (
                  <div className="flex flex-col gap-2">
                    {otherGames.map((g) => (
                      <PitchPadGameCard
                        key={g.id}
                        game={g}
                        onSelect={onSelectGame}
                        disabled={resolving}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
