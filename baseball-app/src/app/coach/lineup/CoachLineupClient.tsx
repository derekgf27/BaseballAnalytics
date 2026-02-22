"use client";

import Link from "next/link";
import { CardTitle } from "@/components/ui/Card";

export interface CoachLineupSlot {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  bats: string | null;
}

interface CoachLineupClientProps {
  lineup: CoachLineupSlot[];
  /** When lineup is from a saved template, show its name. */
  templateName?: string | null;
}

/**
 * Read-only lineup view for coach. No drag-and-drop; changes are made in Analyst.
 */
export function CoachLineupClient({ lineup, templateName }: CoachLineupClientProps) {
  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Lineup
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Today’s batting order. To change it, use Analyst → Lineup or Games.
        </p>
        {templateName && (
          <p className="mt-1 text-sm font-medium text-[var(--text)]">
            Template: {templateName}
          </p>
        )}
      </header>

      {lineup.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[var(--bg-elevated)]">
                <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  #
                </th>
                <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  POS
                </th>
                <th className="border-b border-r border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Player
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Bats
                </th>
              </tr>
            </thead>
            <tbody>
              {lineup.map((slot, i) => (
                <tr
                  key={slot.order}
                  className={`border-b border-[var(--border)] last:border-b-0 ${
                    i % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-elevated)]"
                  }`}
                >
                  <td className="w-12 border-r border-[var(--border)] px-3 py-2 text-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--accent-coach)] text-sm font-bold text-[var(--bg-base)]">
                      {slot.order}
                    </span>
                  </td>
                  <td className="min-w-[5.5rem] w-24 border-r border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-center text-sm font-medium text-[var(--text)]">
                    {slot.position || "—"}
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <Link
                      href={`/coach/players/${slot.playerId}`}
                      className="font-medium text-[var(--accent-coach)] hover:underline"
                    >
                      {slot.playerName}
                    </Link>
                  </td>
                  <td className="w-12 border-l border-[var(--border)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                    {slot.bats ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-tech rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-[var(--text)]">No lineup set</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Create a game and set a lineup in Analyst → Games, or save a template in Analyst → Lineup.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/analyst/lineup" className="text-sm text-[var(--accent-coach)] hover:underline">
          Change lineup in Analyst →
        </Link>
        <Link href="/coach" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Back to Today
        </Link>
      </div>
    </div>
  );
}
