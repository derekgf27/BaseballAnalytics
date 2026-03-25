"use client";

import Link from "next/link";
import type { Player } from "@/lib/types";

interface CoachPlayersClientProps {
  players: Player[];
}

/**
 * Coach view of players: mirrors Analyst players list styling, read-only.
 */
export function CoachPlayersClient({ players }: CoachPlayersClientProps) {
  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Players
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tap a player for strengths, stats, and notes.
        </p>
      </header>

      {players.length === 0 ? (
        <div className="card-tech rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-[var(--text)]">No players</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add players in Analyst → Players.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {players.map((p) => (
            <li
              key={p.id}
              className="card-tech flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-[var(--text)]">
                  {p.name} {p.jersey ? `#${p.jersey}` : ""}
                </span>
                {p.positions?.length > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.positions.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/coach/players/${p.id}`}
                  className="rounded-full border border-[var(--accent-coach)] px-3 py-1 text-sm font-medium text-[var(--accent-coach)] transition hover:bg-[var(--accent-coach-dim)] font-display"
                >
                  Profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
