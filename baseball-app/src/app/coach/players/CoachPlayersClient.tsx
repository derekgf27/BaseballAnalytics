"use client";

import Link from "next/link";
import { CardTitle } from "@/components/ui/Card";
import { PlayerTagList } from "@/components/ui/PlayerTag";
import type { Player } from "@/lib/types";

const TREND_LABELS = {
  hot: { label: "Hot", color: "text-[var(--decision-green)]" },
  cold: { label: "Cold", color: "text-[var(--decision-red)]" },
  neutral: { label: "—", color: "text-[var(--text-muted)]" },
} as const;

interface CoachPlayersClientProps {
  players: Player[];
}

/**
 * Player cards list: name, position, B/T. Trend and tags can be derived later from stats.
 */
export function CoachPlayersClient({ players }: CoachPlayersClientProps) {
  const trend = "neutral";
  const trendStyle = TREND_LABELS[trend];

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Players
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tap a player for strengths, situational value, and notes.
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
            <li key={p.id}>
              <Link
                href={`/coach/players/${p.id}`}
                className="card-tech flex items-center gap-3 rounded-lg border p-3 transition hover:border-[var(--border-focus)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--text)]">{p.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {p.positions?.[0] ?? "—"} · B{p.bats ?? "—"}/T{p.throws ?? "—"}
                    </span>
                    <span className={`text-xs font-medium ${trendStyle.color}`}>
                      {trendStyle.label}
                    </span>
                    <PlayerTagList tags={[]} />
                  </div>
                </div>
                <span className="text-[var(--text-muted)]" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
