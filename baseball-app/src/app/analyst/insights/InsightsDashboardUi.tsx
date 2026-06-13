"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import type {
  ActionItem,
  AlertFeedItem,
  DrillDownData,
  ExecutiveSummary,
  HitterTrendTableRow,
  InsightsDashboard,
  KpiCard,
  PitchArsenalCard,
  PitchIntelligenceCenter,
  PitcherTrendTableRow,
  PlayerTrendsSection,
  TeamStoryItem,
} from "@/lib/insights";

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="font-display text-lg font-semibold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function fmtPitchPct(n: number | null): string {
  return n != null ? `${Math.round(n * 100)}%` : "—";
}

// ---------------------------------------------------------------------------
// Section 1 — Executive Summary
// ---------------------------------------------------------------------------

export function ExecutiveSummaryPanel({ summary }: { summary: ExecutiveSummary }) {
  const trendColor =
    summary.trend === "up"
      ? "text-[var(--success)]"
      : summary.trend === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--text-muted)]";
  const trendArrow = summary.trend === "up" ? "↑" : summary.trend === "down" ? "↓" : "→";

  return (
    <div className="card-tech overflow-hidden rounded-xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent)]/8 via-[var(--bg-card)] to-[var(--bg-card)] p-6 lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Team health
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-display text-6xl font-bold tabular-nums leading-none text-white">
              {summary.healthScore}
            </span>
            <span className="pb-2 text-2xl font-light text-[var(--text-muted)]">/ 100</span>
          </div>
          <p className={`mt-2 text-sm font-semibold ${trendColor}`}>
            {trendArrow} {summary.trendLabel}
          </p>
        </div>

        <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
          {summary.biggestPositive ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                🔥 Biggest positive
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-white">
                {summary.biggestPositive.headline}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{summary.biggestPositive.detail}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--text-muted)]">No clear positive trend yet.</p>
            </div>
          )}

          {summary.biggestConcern ? (
            <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-dim)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--danger)]">
                ⚠️ Biggest concern
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-white">
                {summary.biggestConcern.headline}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{summary.biggestConcern.detail}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--text-muted)]">No major concerns flagged.</p>
            </div>
          )}

          {summary.immediateRecommendation ? (
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                🎯 Do this next
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-white">
                {summary.immediateRecommendation}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--text-muted)]">No immediate action flagged.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Action Center
// ---------------------------------------------------------------------------

function ActionCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: ActionItem[];
  empty: string;
}) {
  return (
    <div className="card-tech flex flex-col rounded-lg border">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug text-white">{item.action}</p>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    item.priority === "high"
                      ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                      : item.priority === "medium"
                        ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{item.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActionCenterPanel({
  actionCenter,
}: {
  actionCenter: InsightsDashboard["actionCenter"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ActionCard title="Offensive actions" items={actionCenter.offensive} empty="No offensive actions right now." />
      <ActionCard title="Pitching actions" items={actionCenter.pitching} empty="No pitching actions right now." />
      <ActionCard title="Defensive actions" items={actionCenter.defensive} empty="No defensive actions right now." />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Team Trends
// ---------------------------------------------------------------------------

function LargeKpiTile({ kpi }: { kpi: KpiCard }) {
  const arrow = kpi.direction === "up" ? "↑" : kpi.direction === "down" ? "↓" : "→";
  const diffColor =
    kpi.positive === null
      ? "text-[var(--text-muted)]"
      : kpi.positive
        ? "text-[var(--success)]"
        : "text-[var(--danger)]";

  return (
    <article className="card-tech rounded-lg border p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {kpi.metric}
      </p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{kpi.current}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-[var(--text-muted)]">Prior {kpi.previous}</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${diffColor}`}>
          {arrow} {kpi.diffLabel}
        </span>
      </div>
    </article>
  );
}

export function TeamTrendsPanel({ kpis }: { kpis: KpiCard[] }) {
  if (kpis.length === 0) {
    return <EmptyNote>Need at least two game samples to compare team trends.</EmptyNote>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <LargeKpiTile key={kpi.metric} kpi={kpi} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Hot & Cold Players
// ---------------------------------------------------------------------------

function HitterTable({ title, rows, accent }: { title: string; rows: HitterTrendTableRow[]; accent: string }) {
  return (
    <div className="card-tech overflow-hidden rounded-lg border">
      <div className={`border-b px-4 py-3 ${accent}`}>
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">None in this sample.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-4 py-2 text-left font-semibold">Player</th>
              <th className="px-4 py-2 text-right font-semibold">OPS</th>
              <th className="px-4 py-2 text-right font-semibold">Trend</th>
              <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Sample</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.playerId} className="hover:bg-[var(--bg-elevated)]/50">
                <td className="px-4 py-2.5">
                  <Link
                    href={analystPlayerProfileHref(row.playerId)}
                    className="font-medium text-white hover:text-[var(--accent)]"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--accent)]">
                  {row.ops}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums ${row.trendImproved ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
                >
                  {row.trendLabel}
                </td>
                <td className="hidden px-4 py-2.5 text-right text-xs text-[var(--text-muted)] sm:table-cell">
                  {row.sampleLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PitcherTable({ title, rows, accent }: { title: string; rows: PitcherTrendTableRow[]; accent: string }) {
  return (
    <div className="card-tech overflow-hidden rounded-lg border">
      <div className={`border-b px-4 py-3 ${accent}`}>
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">None in this sample.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-4 py-2 text-left font-semibold">Player</th>
              <th className="px-4 py-2 text-right font-semibold">ERA</th>
              <th className="px-4 py-2 text-right font-semibold">WHIP</th>
              <th className="hidden px-4 py-2 text-right font-semibold md:table-cell">Strike%</th>
              <th className="px-4 py-2 text-right font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.playerId} className="hover:bg-[var(--bg-elevated)]/50">
                <td className="px-4 py-2.5">
                  <Link
                    href={analystPlayerProfileHref(row.playerId)}
                    className="font-medium text-white hover:text-[var(--accent)]"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.era}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.whip}</td>
                <td className="hidden px-4 py-2.5 text-right font-mono tabular-nums md:table-cell">
                  {row.strikePct ?? "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums ${row.trendImproved ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
                >
                  {row.trendLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function HotColdPlayersPanel({ trends }: { trends: PlayerTrendsSection }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <HitterTable title="Hottest hitters" rows={trends.hottestHitters} accent="bg-orange-500/15" />
      <HitterTable title="Coldest hitters" rows={trends.coldestHitters} accent="bg-sky-500/15" />
      <PitcherTable title="Hottest pitchers" rows={trends.hottestPitchers} accent="bg-emerald-500/15" />
      <PitcherTable title="Struggling pitchers" rows={trends.strugglingPitchers} accent="bg-[var(--danger-dim)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — Pitch Intelligence Center
// ---------------------------------------------------------------------------

function ArsenalCard({ card }: { card: PitchArsenalCard }) {
  return (
    <div className="card-tech rounded-lg border p-4">
      <p className="font-display text-base font-semibold text-white">{card.pitchLabel}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-[var(--text-muted)]">Usage</dt>
          <dd className="font-mono font-semibold tabular-nums text-[var(--accent)]">
            {fmtPitchPct(card.usagePct)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">AVG vs</dt>
          <dd className="font-mono tabular-nums">
            {card.avgAgainst != null ? fmtDecimalNoLeadingZero(card.avgAgainst, 3) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Whiff</dt>
          <dd className="font-mono tabular-nums">{fmtPitchPct(card.whiffPct)}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Strike</dt>
          <dd className="font-mono tabular-nums">{fmtPitchPct(card.strikePct)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[var(--text-muted)]">Swing</dt>
          <dd className="font-mono tabular-nums">{fmtPitchPct(card.swingPct)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function PitchCenterPanel({ center }: { center: PitchIntelligenceCenter }) {
  if (center.arsenal.length === 0) {
    return <EmptyNote>Pitch-type data appears once pitch logs are recorded in games.</EmptyNote>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {center.arsenal.map((card) => (
          <ArsenalCard key={card.pitchType} card={card} />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {center.bestPitch ? (
          <div className="card-tech rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-emerald-300">
              Best pitch
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{center.bestPitch.pitchLabel}</p>
            <p className="mt-1 font-mono text-sm text-[var(--accent)]">
              {center.bestPitch.value} {center.bestPitch.subtext?.toLowerCase()}
            </p>
          </div>
        ) : null}
        {center.mostDangerous ? (
          <div className="card-tech rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-dim)] p-4">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--danger)]">
              Most dangerous
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{center.mostDangerous.pitchLabel}</p>
            <p className="mt-1 font-mono text-sm text-[var(--danger)]">
              {center.mostDangerous.value} avg against
            </p>
          </div>
        ) : null}
        {center.recommendedAdjustment ? (
          <div className="card-tech rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-4 md:col-span-1">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
              Recommended adjustment
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white">{center.recommendedAdjustment}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 6 — Team Story
// ---------------------------------------------------------------------------

export function TeamStoryPanel({ items }: { items: TeamStoryItem[] }) {
  if (items.length === 0) {
    return <EmptyNote>Narrative summary builds as more games and trends accumulate.</EmptyNote>;
  }
  return (
    <div className="card-tech space-y-4 rounded-lg border px-5 py-5">
      {items.map((item) => (
        <p key={item.id} className="text-sm leading-relaxed text-[var(--text)]">
          {item.text}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Alerts Feed (sticky sidebar)
// ---------------------------------------------------------------------------

const ALERT_TONE_CLASS: Record<AlertFeedItem["tone"], string> = {
  positive: "border-l-emerald-500 bg-emerald-500/10",
  warning: "border-l-amber-500 bg-amber-500/10",
  critical: "border-l-[var(--danger)] bg-[var(--danger-dim)]",
};

export function AlertsFeedPanel({
  alerts,
  dismissed,
  onDismiss,
}: {
  alerts: AlertFeedItem[];
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const visible = useMemo(() => alerts.filter((a) => !dismissed.has(a.id)), [alerts, dismissed]);

  return (
    <div className="card-tech flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-lg border">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Alerts</h2>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{visible.length} active</p>
      </div>
      <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No active alerts.</li>
        ) : (
          visible.map((alert) => (
            <li
              key={alert.id}
              className={`border-l-4 px-4 py-3 ${ALERT_TONE_CLASS[alert.tone]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed text-[var(--text)]">{alert.message}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(alert.id)}
                  className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)] hover:text-white"
                  aria-label="Dismiss alert"
                >
                  ×
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detailed analytics (always visible)
// ---------------------------------------------------------------------------

function DrillDownKpis({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {kpis.map((k) => (
        <LargeKpiTile key={k.metric} kpi={k} />
      ))}
    </div>
  );
}

function PitchMixTable({ rows }: { rows: DrillDownData["pitchRows"] }) {
  if (rows.length === 0) return <EmptyNote>No pitch mix data.</EmptyNote>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <th className="px-4 py-2 text-left">Pitch</th>
            <th className="px-4 py-2 text-right">Usage</th>
            <th className="px-4 py-2 text-right">AVG vs</th>
            <th className="px-4 py-2 text-right">Whiff</th>
            <th className="px-4 py-2 text-right">Strike</th>
            <th className="px-4 py-2 text-right">2K whiff</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr key={row.pitchType}>
              <td className="px-4 py-2 font-medium text-white">{row.pitchLabel}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{fmtPitchPct(row.usagePct)}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {row.avgAgainst != null ? fmtDecimalNoLeadingZero(row.avgAgainst, 3) : "—"}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{fmtPitchPct(row.whiffPct)}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{fmtPitchPct(row.strikePct)}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {fmtPitchPct(row.twoStrikeWhiffPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerDetailLists({ drillDown }: { drillDown: DrillDownData }) {
  const fmtPlayer = (p: { playerId: string; name: string; primaryLine: { label: string; formatted: string }; sampleLabel: string }) => (
    <li key={p.playerId}>
      <Link
        href={analystPlayerProfileHref(p.playerId)}
        className="hover:text-[var(--accent)]"
      >
        {p.name} — {p.primaryLine.label} {p.primaryLine.formatted}
      </Link>
    </li>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-tech rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Hot hitters</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          {drillDown.hotHitters.length === 0 ? (
            <li>None</li>
          ) : (
            drillDown.hotHitters.map(fmtPlayer)
          )}
        </ul>
      </div>
      <div className="card-tech rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--danger)]">Cold hitters</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          {drillDown.coldHitters.length === 0 ? (
            <li>None</li>
          ) : (
            drillDown.coldHitters.map(fmtPlayer)
          )}
        </ul>
      </div>
      <div className="card-tech rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Hot pitchers</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          {drillDown.hotPitchers.length === 0 ? (
            <li>None</li>
          ) : (
            drillDown.hotPitchers.map(fmtPlayer)
          )}
        </ul>
      </div>
      <div className="card-tech rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--danger)]">Cold pitchers</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          {drillDown.coldPitchers.length === 0 ? (
            <li>None</li>
          ) : (
            drillDown.coldPitchers.map(fmtPlayer)
          )}
        </ul>
      </div>
    </div>
  );
}

export function DrillDownPanel({ drillDown }: { drillDown: DrillDownData }) {
  const offenseKpis = drillDown.kpis.filter(
    (k) => !k.metric.includes("Strike") && !k.metric.includes("Whiff")
  );

  return (
    <div className="space-y-8">
      {offenseKpis.length > 0 ? (
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Offense detail
          </h3>
          <div className="mt-3">
            <DrillDownKpis kpis={offenseKpis} />
          </div>
        </div>
      ) : null}

      {drillDown.pitchKpis.length > 0 ? (
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Pitching trends
          </h3>
          <div className="mt-3">
            <DrillDownKpis kpis={drillDown.pitchKpis} />
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Pitch mix
        </h3>
        <div className="mt-3">
          <PitchMixTable rows={drillDown.pitchRows} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Player trend detail
        </h3>
        <div className="mt-3">
          <PlayerDetailLists drillDown={drillDown} />
        </div>
      </div>
    </div>
  );
}

export function DashboardMetaBar({ meta }: { meta: InsightsDashboard["meta"] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
      <span>
        Sample:{" "}
        <span className="font-semibold tabular-nums text-[var(--text)]">{meta.gameCount}</span> finalized games
      </span>
      <span className="hidden sm:inline">·</span>
      <span>
        <span className="font-semibold tabular-nums text-[var(--text)]">{meta.paCount}</span> club batting PAs
      </span>
      <span className="hidden sm:inline">·</span>
      <span>KPI window: last 3 games vs prior sample</span>
    </div>
  );
}
