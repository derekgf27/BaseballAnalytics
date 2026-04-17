"use client";

import Link from "next/link";

export interface CoachLineupRow {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  bats: string | null;
}

interface CoachLineupTableProps {
  lineup: CoachLineupRow[];
}

/**
 * Shared lineup table used in Coach → Lineup and Coach Today.
 * Visual format mirrors the lineup constructor: # / POS / PLAYER / BATS.
 */
export function CoachLineupTable({ lineup }: CoachLineupTableProps) {
  if (!lineup.length) {
    return (
      <div className="neo-card flex h-full min-h-0 flex-col border border-dashed border-[var(--neo-border)] p-4 lg:p-5">
        <div className="section-label mb-3">Lineup</div>
        <div className="py-4 text-center lg:py-6">
          <p className="font-medium text-[var(--neo-text)]">No lineup set</p>
          <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
            Create a game and set a lineup in Analyst → Games, or save a template in Analyst → Lineup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="px-4 pt-4 lg:px-5 lg:pt-5">
        <div className="section-label mb-3">Lineup</div>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[#151b21]">
            <th className="font-display border-b border-r border-black/40 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
              #
            </th>
            <th className="font-display border-b border-r border-black/40 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
              POS
            </th>
            <th className="font-display border-b border-r border-black/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
              Player
            </th>
            <th className="font-display border-b border-black/40 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
              Bats
            </th>
          </tr>
        </thead>
        <tbody>
          {lineup.map((slot, i) => (
            <tr
              key={slot.order}
              className={`border-b border-black/40 last:border-b-0 ${
                i % 2 === 0 ? "bg-[#10151a]" : "bg-[#12181f]"
              }`}
            >
              <td className="w-12 border-r border-[var(--border)] px-3 py-2 text-center">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--neo-accent)] text-sm font-bold text-[var(--bg-base)] shadow-[0_0_18px_rgba(214,186,72,0.6)]">
                  {slot.order}
                </span>
              </td>
              <td className="min-w-[5.5rem] w-24 border-r border-black/40 bg-black/20 px-2 py-2 text-center text-sm font-medium text-[var(--neo-text)]">
                {slot.position || "—"}
              </td>
              <td className="min-w-0 px-3 py-2">
                <Link
                  href={`/coach/players/${slot.playerId}`}
                  className="font-medium text-[var(--neo-accent)] hover:underline"
                >
                  {slot.playerName}
                </Link>
              </td>
              <td className="w-12 border-l border-black/40 px-3 py-2 text-center text-sm font-semibold text-[var(--neo-text)]">
                {slot.bats ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

