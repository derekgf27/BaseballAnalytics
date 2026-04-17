"use client";

import Link from "next/link";
import type { BattingStatsWithSplits } from "@/lib/types";
import type { Player } from "@/lib/types";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";

function fmt3(n: number) {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

export function PlayersToWatch({
  roster,
  statsByPlayerId,
}: {
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
}) {
  const rows = roster
    .map((p) => {
      const o = statsByPlayerId[p.id]?.overall;
      return { player: p, pa: o?.pa ?? 0, ops: o?.ops ?? 0, avg: o?.avg ?? 0 };
    })
    .filter((r) => r.pa >= 5)
    .sort((a, b) => b.ops - a.ops);

  const hot = rows.slice(0, 3);
  const cold = [...rows].reverse().slice(0, 3);
  const trending = rows.slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4 transition hover:border-orange-400/50">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-orange-300">
          Hot hitters
        </h3>
        <ul className="mt-3 space-y-3">
          {hot.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">Need ≥5 PA on roster to rank.</li>
          ) : (
            hot.map(({ player, ops, pa, avg }) => (
              <li
                key={player.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 transition hover:border-[var(--accent)]/40"
              >
                <Link
                  href={analystPlayerProfileHref(player.id)}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {player.name}
                </Link>
                <p className="text-xs text-[var(--text-muted)]">OPS {fmt3(ops)} · {pa} PA · AVG {fmt3(avg)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-emerald-400/90">Trend: up (season line)</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 transition hover:border-sky-400/50">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-sky-300">
          Cold hitters
        </h3>
        <ul className="mt-3 space-y-3">
          {cold.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">Need ≥5 PA on roster to rank.</li>
          ) : (
            cold.map(({ player, ops, pa }) => (
              <li
                key={player.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 transition hover:border-[var(--accent)]/40"
              >
                <Link
                  href={analystPlayerProfileHref(player.id)}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {player.name}
                </Link>
                <p className="text-xs text-[var(--text-muted)]">OPS {fmt3(ops)} · {pa} PA</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-sky-300/80">Recent struggles (season)</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition hover:border-[var(--accent)]/40">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
          Trending
        </h3>
        <ul className="mt-3 space-y-2">
          {trending.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">Not enough volume.</li>
          ) : (
            trending.map(({ player, ops }) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              >
                <span className="truncate text-[var(--text)]">{player.name}</span>
                <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                  <span className="text-emerald-400" aria-hidden>
                    {"\u25B2"}
                  </span>
                  <span className="mx-1 text-[var(--text-faint)]">/</span>
                  <span className="text-rose-400" aria-hidden>
                    {"\u25BC"}
                  </span>
                  <span className="ml-1">OPS {fmt3(ops)}</span>
                </span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-[10px] text-[var(--text-faint)]">
          Arrows are placeholders; wire rolling windows when you want automatic trend direction.
        </p>
      </section>
    </div>
  );
}
