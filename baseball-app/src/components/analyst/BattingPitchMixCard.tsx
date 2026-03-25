"use client";

import { useMemo } from "react";
import { pitchMixFromPlateAppearances } from "@/lib/compute/battingStats";
import type { PlateAppearance, Player } from "@/lib/types";

function paChronological(a: PlateAppearance, b: PlateAppearance): number {
  if (a.inning !== b.inning) return a.inning - b.inning;
  const ha = a.inning_half === "top" ? 0 : 1;
  const hb = b.inning_half === "top" ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

function pitcherIdsInOrder(pas: PlateAppearance[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const pa of [...pas].sort(paChronological)) {
    if (!pa.pitcher_id || seen.has(pa.pitcher_id)) continue;
    seen.add(pa.pitcher_id);
    ids.push(pa.pitcher_id);
  }
  return ids;
}

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatPpa(p: number | null): string {
  if (p == null) return "—";
  return p.toFixed(1);
}

type PitchMixLine = ReturnType<typeof pitchMixFromPlateAppearances>;

function PitchMixRow({
  name,
  mix,
  nameClass,
  compact,
  multi,
}: {
  name: string;
  mix: PitchMixLine;
  nameClass: string;
  compact: boolean;
  multi: boolean;
}) {
  const rowClass = compact
    ? "flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-tight sm:text-xs"
    : "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-tight";

  const lab = (label: string, full: string) => (
    <span className="shrink-0 font-semibold text-white" title={compact ? undefined : full}>
      {label}
    </span>
  );

  const valClass = "tabular-nums font-semibold text-[var(--accent)]";
  const missingClass = "tabular-nums font-medium text-[var(--text-muted)]";

  const sep = <span className="shrink-0 text-white/35">·</span>;

  return (
    <li
      className={
        multi
          ? "px-2 py-2 sm:px-3"
          : "rounded border border-[var(--border)]/50 bg-[var(--bg-elevated)]/25 px-3 py-2.5"
      }
    >
      <p className={`mb-1 ${nameClass}`} title={name}>
        {name}
      </p>
      <div className={rowClass} role="group" aria-label={`Pitch mix for ${name}`}>
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
          {lab("FPS:", "First pitch strikes")}
          <span className={mix.firstPitchOpportunities > 0 ? valClass : missingClass}>
            {mix.firstPitchOpportunities > 0
              ? `${mix.firstPitchStrikes} / ${mix.firstPitchOpportunities}`
              : "—"}
            {mix.firstPitchStrikePct != null && mix.firstPitchOpportunities > 0 ? (
              <span className="text-[var(--accent)]/85">
                {" "}
                ({formatPct(mix.firstPitchStrikePct)})
              </span>
            ) : null}
          </span>
        </span>
        {sep}
        <span className="inline-flex items-baseline gap-x-1">
          {lab("Strike %:", "Strike percentage")}
          <span className={mix.strikePct != null ? valClass : missingClass}>{formatPct(mix.strikePct)}</span>
        </span>
        {sep}
        <span className="inline-flex items-baseline gap-x-1">
          {lab("P/PA:", "Pitches per plate appearance")}
          <span className={valClass}>{formatPpa(mix.pitchesPerPA)}</span>
        </span>
        {sep}
        <span className="inline-flex items-baseline gap-x-1">
          {lab("Pitches:", "Pitches thrown")}
          <span
            className={mix.plateAppearancesWithPitchCount > 0 ? valClass : missingClass}
          >
            {mix.plateAppearancesWithPitchCount > 0 ? mix.pitchesTotal : "—"}
          </span>
        </span>
      </div>
    </li>
  );
}

/** `pas`: plate appearances with this team on the mound (see `plateAppearancesForPitchingSide`). */
export function BattingPitchMixCard({
  pas,
  players,
  compact = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  compact?: boolean;
}) {
  const rows = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return pitcherIdsInOrder(pas).map((pitcherId) => {
      const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
      const mix = pitchMixFromPlateAppearances(pitcherPas);
      const name = byId.get(pitcherId)?.name?.trim() || "Unknown";
      return { pitcherId, name, mix };
    });
  }, [pas, players]);

  const multi = rows.length > 1;

  const pad = compact ? "px-2 py-1.5" : "px-2.5 py-2";
  const titleClass = compact
    ? "font-display text-[9px] font-semibold uppercase tracking-wider text-white"
    : "font-display text-xs font-semibold uppercase tracking-wider text-white";

  const nameClass =
    "truncate font-display font-semibold text-[var(--accent)] " +
    (compact ? "text-xs" : "text-sm");

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--bg-card)] ${pad}`}>
      <div
        className={`flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0 ${compact ? "mb-1" : "mb-2"}`}
      >
        <h3 className={titleClass}>Pitch data</h3>
        {multi ? (
          <span className="text-[9px] font-medium tabular-nums text-[var(--text-muted)]">
            {rows.length} pitchers
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-[10px] text-[var(--text-muted)]">—</p>
      ) : multi ? (
        <div
          className={`overflow-y-auto overflow-x-hidden rounded border border-[var(--border)]/60 bg-[var(--bg-elevated)]/30 ${
            compact ? "max-h-[min(26vh,8.5rem)]" : "max-h-[min(30vh,9.5rem)]"
          }`}
        >
          <ul className="divide-y divide-[var(--border)]/50">
            {rows.map((row) => (
              <PitchMixRow
                key={row.pitcherId}
                name={row.name}
                mix={row.mix}
                nameClass={nameClass}
                compact={compact}
                multi
              />
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <PitchMixRow
              key={row.pitcherId}
              name={row.name}
              mix={row.mix}
              nameClass={nameClass}
              compact={compact}
              multi={false}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
