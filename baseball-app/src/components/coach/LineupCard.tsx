"use client";

import type { LineupRole } from "@/lib/types";

interface LineupCardProps {
  slot: number;
  playerName: string;
  role: LineupRole;
}

const ROLE_STYLE: Record<LineupRole, string> = {
  "Table-setter": "border-cyan-500/50 bg-cyan-500/10 text-cyan-400",
  Damage: "border-amber-500/50 bg-amber-500/10 text-amber-400",
  Protection: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  Bottom: "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)]",
  Other: "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-faint)]",
};

export function LineupCard({ slot, playerName, role }: LineupCardProps) {
  return (
    <div className="card-tech flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-coach)] text-sm font-bold text-[var(--bg-base)]">
        {slot}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--text)]">{playerName}</p>
        <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[role]}`}>
          {role}
        </span>
      </div>
    </div>
  );
}
