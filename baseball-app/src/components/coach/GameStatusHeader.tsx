"use client";

import { motion } from "framer-motion";

export interface GameStatusHeaderProps {
  opponent: string;
  venue: string;
  venueType: "home" | "away";
  date: string;
  startTime?: string;
  /** Optional: not in DB yet — placeholder when missing */
  inning?: string | null;
  /** Optional: not in DB yet — placeholder when missing */
  score?: { us: number; them: number } | null;
}

export function GameStatusHeader({
  opponent,
  venue,
  venueType,
  date,
  startTime,
  inning = null,
  score = null,
}: GameStatusHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <div className="section-label">Current game</div>
        <p className="mt-1 text-sm text-[var(--neo-text-muted)]">
          {venue} · {date}
          {startTime ? ` · ${startTime}` : ""}
        </p>
        <p className="text-base font-semibold text-[var(--neo-text)]">
          {venueType === "home" ? "vs" : "@"} {opponent}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {inning != null && (
          <div className="rounded-lg bg-black/30 px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--neo-text)]">
            INNING <span className="text-[var(--neo-accent)]">{inning}</span>
          </div>
        )}
        {score != null && (
          <div className="rounded-lg bg-black/30 px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--neo-text)]">
            {score.us}
            <span className="mx-1 text-[var(--neo-text-muted)]">:</span>
            {score.them}
          </div>
        )}
        {inning == null && score == null && (
          <span className="text-xs text-[var(--neo-text-muted)]">—</span>
        )}
      </div>
    </motion.div>
  );
}
