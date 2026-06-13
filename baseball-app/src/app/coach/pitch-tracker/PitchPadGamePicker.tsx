"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
          {featuredGameHeading(game, today)} · {venue}
        </p>
        <p className="mt-2 font-orbitron text-2xl font-bold tracking-tight text-zinc-50">
          vs {opponent}
        </p>
        <p className="mt-1 text-sm text-zinc-400">{formatDateMMDDYYYY(game.date)}</p>
        {sessionStarted ? (
          <p className="mt-2 text-xs font-medium text-amber-300/90">Session started — tap to resume</p>
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
      className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-4 text-left transition hover:border-emerald-600/50 hover:bg-zinc-900 active:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {venue}
        </span>
        {sessionStarted ? (
          <span className="shrink-0 rounded-full bg-amber-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
            In progress
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-lg font-semibold text-zinc-100">vs {opponent}</p>
      <p className="mt-0.5 text-sm text-zinc-400">{formatDateMMDDYYYY(game.date)}</p>
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
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href="/coach"
          className="touch-manipulation inline-flex h-11 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 active:bg-zinc-600"
          aria-label="Back to coach home"
        >
          <span className="text-base leading-none" aria-hidden>
            ←
          </span>
          <span>Coach home</span>
        </Link>

        <div>
          <h1 className="font-orbitron text-2xl font-bold tracking-tight">Pitch pad</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Pick tonight&apos;s game to start tracking pitches. Batter, count, and outs update live with the
            scorekeeper.
          </p>
        </div>

        {resolveError ? (
          <p
            className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            {resolveError}
          </p>
        ) : null}

        {gamesLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading games">
            <div className="h-40 animate-pulse rounded-2xl bg-zinc-900/80" />
            <div className="h-20 animate-pulse rounded-xl bg-zinc-900/60" />
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-zinc-200">No active games yet</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
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
                  className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-sm font-semibold text-zinc-400 transition hover:text-zinc-200"
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
