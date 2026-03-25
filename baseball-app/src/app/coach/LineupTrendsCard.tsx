"use client";

import type { TodayLineupSlot } from "./CoachTodayClient";

function formatAvgLike(value: number): string {
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

interface LineupTrendsCardProps {
  recommendedLineup: TodayLineupSlot[];
}

export function LineupTrendsCard({ recommendedLineup }: LineupTrendsCardProps) {
  const ordered = [...recommendedLineup].sort((a, b) => a.order - b.order);
  const hotPlayers = ordered.filter((s) => s.trend === "hot");
  const coldPlayers = ordered.filter((s) => s.trend === "cold");

  const renderList = (players: typeof hotPlayers, tone: "hot" | "cold") =>
    players.map((p) => {
      const rs = p.recentStats;
      const badgeStyle =
        tone === "hot"
          ? "bg-red-600/35 text-red-100 border border-red-300/60"
          : "bg-sky-500/35 text-cyan-50 border border-sky-200/60";
      const toneLabel = tone === "hot" ? "HOT" : "COLD";

      return (
        <li
          key={`${p.playerId}-${tone}`}
          className="flex items-start justify-between gap-3 rounded-lg border border-[var(--neo-border)] bg-[#10161d] px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--neo-text)]">{p.playerName}</p>
            <p className="mt-0.5 text-xs text-[var(--neo-text-muted)]">
              {rs
                ? `Last ${rs.pa} PA · (${rs.h} for ${rs.ab}) · AVG ${formatAvgLike(rs.avg)} · OPS ${formatAvgLike(rs.ops)}`
                : "Trend detected from recent results"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${badgeStyle}`}
          >
            {toneLabel}
          </span>
        </li>
      );
    });

  return (
    <div className="neo-card p-4 lg:p-5">
      <h2 className="section-label mb-3">Trends</h2>

      {hotPlayers.length === 0 && coldPlayers.length === 0 ? (
        <p className="text-sm text-[var(--neo-text-muted)]">No strong hot or cold trends in lineup.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-card)]/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-[var(--neo-border)]">
            <div className="min-w-0 border-b border-[var(--neo-border)] sm:border-b-0">
              <div className="border-b border-red-300/40 bg-red-600/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-100">
                🔥 Hot now
              </div>
              {hotPlayers.length > 0 ? (
                <ul className="space-y-2 p-3">{renderList(hotPlayers, "hot")}</ul>
              ) : (
                <p className="px-3 py-3 text-sm text-[var(--neo-text-muted)]">No hot players right now.</p>
              )}
            </div>

            <div className="min-w-0">
              <div className="border-b border-sky-200/40 bg-sky-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-50">
                ❄️ Cold now
              </div>
              {coldPlayers.length > 0 ? (
                <ul className="space-y-2 p-3">{renderList(coldPlayers, "cold")}</ul>
              ) : (
                <p className="px-3 py-3 text-sm text-[var(--neo-text-muted)]">No cold players right now.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
