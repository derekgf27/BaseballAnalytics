"use client";

import { motion } from "framer-motion";

/** Value 0–1. Placeholder when no real data (e.g. 0.5). */
export function AggressionMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="section-label">Aggression level</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b242b]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--neo-secondary)] via-[var(--neo-accent)] to-[var(--neo-success)]"
          style={{ boxShadow: "0 0 12px var(--neo-accent)" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
