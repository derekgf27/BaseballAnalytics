"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { BattingStatsWithSplits } from "@/lib/types";
import type { Player } from "@/lib/types";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";

function fmt3(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function PlayerReportsTab({
  roster,
  statsByPlayerId,
}: {
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        Tap a player to expand. Stats are season-to-date from logged PAs (same engine as the roster profile).
      </p>
      <ul className="space-y-2">
        {roster.map((p) => {
          const s = statsByPlayerId[p.id];
          const o = s?.overall;
          const open = openId === p.id;
          const pa = o?.pa ?? 0;
          return (
            <li
              key={p.id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] transition hover:border-[var(--accent)]/40"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : p.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="font-medium text-[var(--text)]">
                  {p.name}
                  {p.jersey ? <span className="text-[var(--text-muted)]"> #{p.jersey}</span> : null}
                  <span className="ml-2 text-sm text-[var(--text-muted)]">
                    {pa > 0 ? `${pa} PA · OPS ${fmt3(o?.ops)}` : "No PA yet"}
                  </span>
                </span>
                <span className="text-[var(--accent)]">{open ? "−" : "+"}</span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/50"
                  >
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Slash line
                        </h4>
                        <p className="mt-2 font-display text-xl font-bold tabular-nums text-[var(--text)]">
                          {o && pa > 0
                            ? `${fmt3(o.avg)} / ${fmt3(o.obp)} / ${fmt3(o.slg)} / ${fmt3(o.ops)}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Plate discipline
                        </h4>
                        <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
                          <li>K%: {o && pa > 0 ? fmtPct(o.kPct ?? 0) : "—"}</li>
                          <li>BB%: {o && pa > 0 ? fmtPct(o.bbPct ?? 0) : "—"}</li>
                          <li className="text-[var(--text-muted)]">
                            First-pitch swing % — use profile for pitch-level detail.
                          </li>
                        </ul>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Situational splits
                        </h4>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {(
                            [
                              { label: "vs RHP", sp: s?.vsR },
                              { label: "vs LHP", sp: s?.vsL },
                              { label: "RISP", sp: s?.risp },
                            ] as const
                          ).map(({ label, sp }) => {
                            const st = sp;
                            const pav = st?.pa ?? 0;
                            return (
                              <div
                                key={label}
                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                              >
                                <div className="font-semibold text-[var(--text-muted)]">{label}</div>
                                {pav > 0 ? (
                                  <div className="mt-1 tabular-nums text-[var(--text)]">
                                    {fmt3(st?.avg)} / {fmt3(st?.ops)} · {pav} PA
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[var(--text-faint)]">—</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Recent trend
                        </h4>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                          Last 5–10 PA narrative: open the player profile for the full event list. Hot/cold: compare
                          recent game OPS to season line manually for now.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Spray chart
                        </h4>
                        <div className="mt-2 flex h-36 items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--bg-base)] text-sm text-[var(--text-muted)]">
                          Spray chart placeholder — view interactive chart on profile.
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Insights
                        </h4>
                        <ul className="mt-2 list-inside list-disc text-sm text-[var(--text-muted)]">
                          <li>Pull-heavy if spray data shows — check profile.</li>
                          <li>Late on velo — qualitative; add after video.</li>
                        </ul>
                        <Link
                          href={analystPlayerProfileHref(p.id)}
                          className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
                        >
                          Open full profile →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
