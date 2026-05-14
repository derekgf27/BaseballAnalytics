"use client";

import { useMemo, type ReactNode } from "react";
import type { PreGameOverviewPayload } from "@/app/reports/actions";
import { FINAL_COUNT_PAIRS, finalCountBucketKey } from "@/lib/compute/battingStatsWithSplitsFromPas";
import type {
  PreGameCoachHittingNotes,
  PreGameContactProfile,
  PreGamePitchMixRow,
  PreGameReportSections,
} from "@/lib/reports/preGameReportBuild";
import {
  isActiveRosterPlayer,
  isPitcherPlayer,
  matchupLabelUsFirst,
  ourVenueLabel,
} from "@/lib/opponentUtils";
import { fmtDecimalNoLeadingZero, fmtPitchDecimal, formatDateMMDDYYYY } from "@/lib/format";
import { formatBattingTripleSlash } from "@/lib/format/battingSlash";
import type {
  BattingStats,
  BattingStatsWithSplits,
  Bats,
  Game,
  PitchingRateLine,
  PitchingStats,
  Player,
  Throws,
} from "@/lib/types";

function fmt3(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtDecimalNoLeadingZero(n, 3);
}

/** Opponent batting average allowed: H / AB against (official AB on this pitcher's PAs). */
function fmtBaaAgainst(o: PitchingStats): string {
  const ab = o.abAgainst;
  if (ab == null || ab < 1 || !Number.isFinite(ab)) return "—";
  return fmt3(o.h / ab);
}

function batsAbbr(b: Bats | null | undefined): string {
  if (b === "L") return "L";
  if (b === "R") return "R";
  if (b === "S") return "S";
  return "—";
}

function pct1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function fmtHitsAb(stats: BattingStats | null | undefined): string {
  if (!stats || (stats.pa ?? 0) < 1) return "—";
  const h = stats.h ?? 0;
  const ab = stats.ab ?? 0;
  return `${h}–${ab}`;
}

function fmtKbbFromLine(stats: BattingStats | null | undefined): { kPct: string; bbPct: string } {
  if (!stats || (stats.pa ?? 0) < 1) return { kPct: "—", bbPct: "—" };
  return { kPct: pct1(stats.kPct), bbPct: pct1(stats.bbPct) };
}

function fmtPpa(stats: BattingStats | null | undefined): string {
  const ppa = stats?.pPa;
  if (ppa == null || !Number.isFinite(ppa)) return "—";
  return fmtDecimalNoLeadingZero(ppa, 1);
}

function rispSlashDisplay(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/\b0\./g, ".");
}

function rispCompactRow(player: Player, splits: BattingStatsWithSplits | undefined): {
  playerId: string;
  name: string;
  jersey: string;
  posLabel: string;
  bats: string;
  pa: number;
  hAbDisplay: string;
  ppaDisplay: string;
  opsDisplay: string;
  slash: string;
  kPctDisplay: string;
  bbPctDisplay: string;
} | null {
  const r = splits?.risp;
  if (!r || (r.pa ?? 0) < 1) return null;
  const kb = fmtKbbFromLine(r);
  return {
    playerId: player.id,
    name: player.name,
    jersey: player.jersey?.trim() || "—",
    posLabel: player.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—",
    bats: batsAbbr(player.bats),
    pa: r.pa ?? 0,
    hAbDisplay: fmtHitsAb(r),
    ppaDisplay: fmtPpa(r),
    opsDisplay: fmtSeason(r.ops),
    slash: formatBattingTripleSlash(r.avg, r.obp, r.slg),
    kPctDisplay: kb.kPct,
    bbPctDisplay: kb.bbPct,
  };
}

/** Row for platoon leaderboard vs opponent starter handedness; `sortOps` drives sort order. */
function platoonVsStarterLeaderboardRow(
  player: Player,
  splits: BattingStatsWithSplits | undefined,
  oppThrows: Throws | null | undefined
): {
  playerId: string;
  name: string;
  jersey: string;
  posLabel: string;
  bats: string;
  pa: number;
  slash: string;
  opsDisplay: string;
  wobaDisplay: string;
  hAbDisplay: string;
  ppaDisplay: string;
  kPctDisplay: string;
  bbPctDisplay: string;
  sortOps: number;
} {
  const o = splits?.overall;
  const jersey = player.jersey?.trim() || "—";
  const posLabel = player.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
  const bats = batsAbbr(player.bats);
  if (!o || (o.pa ?? 0) < 1) {
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: 0,
      slash: "—",
      opsDisplay: "—",
      wobaDisplay: "—",
      hAbDisplay: "—",
      ppaDisplay: "—",
      kPctDisplay: "—",
      bbPctDisplay: "—",
      sortOps: -1,
    };
  }

  if (!oppThrows) {
    const kb = fmtKbbFromLine(o);
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: o.pa ?? 0,
      slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
      opsDisplay: fmtSeason(o.ops),
      wobaDisplay: fmtSeason(o.woba),
      hAbDisplay: fmtHitsAb(o),
      ppaDisplay: fmtPpa(o),
      kPctDisplay: kb.kPct,
      bbPctDisplay: kb.bbPct,
      sortOps: o.ops,
    };
  }

  const plat = oppThrows === "L" ? splits?.vsL : splits?.vsR;
  const platPa = plat?.pa ?? 0;
  if (plat && platPa >= 1) {
    const kb = fmtKbbFromLine(plat);
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: platPa,
      slash: formatBattingTripleSlash(plat.avg, plat.obp, plat.slg),
      opsDisplay: fmtSeason(plat.ops),
      wobaDisplay: fmtSeason(plat.woba),
      hAbDisplay: fmtHitsAb(plat),
      ppaDisplay: fmtPpa(plat),
      kPctDisplay: kb.kPct,
      bbPctDisplay: kb.bbPct,
      sortOps: plat.ops,
    };
  }

  const kb = fmtKbbFromLine(o);
  return {
    playerId: player.id,
    name: player.name,
    jersey,
    posLabel,
    bats,
    pa: o.pa ?? 0,
    slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
    opsDisplay: fmtSeason(o.ops),
    wobaDisplay: fmtSeason(o.woba),
    hAbDisplay: fmtHitsAb(o),
    ppaDisplay: fmtPpa(o),
    kPctDisplay: kb.kPct,
    bbPctDisplay: kb.bbPct,
    sortOps: o.ops,
  };
}

function fmtSeason(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtDecimalNoLeadingZero(n, 3);
}

function pitcherHandLabel(t: Throws | null | undefined): string {
  if (t === "L") return "LHP";
  if (t === "R") return "RHP";
  return "—";
}

function resolvePlayer(id: string, overview: PreGameOverviewPayload | null, roster: Player[]): Player | undefined {
  return overview?.playersById[id] ?? roster.find((p) => p.id === id);
}

function SituationalTeamCard({
  title,
  line,
}: {
  title: string;
  line: { pa: number; ops: number; obp: number; kPct: number } | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/25 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</div>
      {line ? (
        <p className="mt-2 font-display text-sm tabular-nums text-[var(--text)]">
          {line.pa} PA · OPS {fmt3(line.ops)} · OBP {fmt3(line.obp)} · K% {pct1(line.kPct)}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Sample too small.</p>
      )}
    </div>
  );
}

function TwoStrikeTeamPrintTiles({ line }: { line: PreGameCoachHittingNotes["twoStrikeTeam"] }) {
  if (!line) {
    return (
      <p className="mt-4 rounded-lg border-2 border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
        Not enough team PAs with a final count of 2+ strikes in this window.
      </p>
    );
  }
  const tiles = [
    { label: "PA", value: String(line.pa) },
    { label: "OPS", value: fmt3(line.ops) },
    { label: "OBP", value: fmt3(line.obp) },
    { label: "K%", value: pct1(line.kPct) },
  ] as const;
  return (
    <div
      className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:gap-4"
      style={{ breakInside: "avoid" as const }}
    >
      {tiles.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-3 text-center print:px-4 print:py-4"
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">
            {label}
          </div>
          <div className="mt-1 font-display text-xl font-bold tabular-nums leading-none text-[var(--text)] print:text-3xl print:mt-2">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactMixStrip({
  contact,
  forPrint = false,
}: {
  contact: PreGameContactProfile;
  forPrint?: boolean;
}) {
  const tiles = [
    {
      label: "GB%",
      pct: contact.gbPct,
      screen:
        "border-l-emerald-600 dark:border-l-emerald-400 bg-emerald-100/85 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100",
      printAccent: "print:border-l-emerald-700 print:bg-emerald-50 print:text-slate-900",
    },
    {
      label: "LD%",
      pct: contact.ldPct,
      screen:
        "border-l-amber-600 dark:border-l-amber-400 bg-amber-100/85 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100",
      printAccent: "print:border-l-amber-700 print:bg-amber-50 print:text-slate-900",
    },
    {
      label: "FB%",
      pct: contact.fbPct,
      screen: "border-l-sky-600 dark:border-l-sky-400 bg-sky-100/85 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100",
      printAccent: "print:border-l-sky-700 print:bg-sky-50 print:text-slate-900",
    },
    {
      label: "IFF%",
      pct: contact.iffPct,
      screen:
        "border-l-violet-600 dark:border-l-violet-400 bg-violet-100/85 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100",
      printAccent: "print:border-l-violet-700 print:bg-violet-50 print:text-slate-900",
    },
  ] as const;

  return (
    <div
      className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 ${forPrint ? "print:mt-4 print:gap-3" : ""}`}
      style={forPrint ? { breakInside: "avoid" as const } : undefined}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-lg border border-[var(--border)] border-l-4 px-3 py-2.5 text-center ${t.screen} ${forPrint ? `${t.printAccent} print:px-4 print:py-3 print:border-2 print:border-slate-300` : ""}`}
        >
          <div
            className={`text-[10px] font-bold uppercase tracking-wide opacity-90 ${forPrint ? "print:text-xs" : ""}`}
          >
            {t.label}
          </div>
          <div
            className={`mt-1 font-display text-lg font-bold tabular-nums leading-none ${forPrint ? "print:text-2xl print:mt-1.5" : ""}`}
          >
            {pct1(t.pct)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SituationalHittersTable({
  title,
  rows,
  forPrint = false,
}: {
  title: string;
  rows: PreGameCoachHittingNotes["twoStrikeHitters"];
  forPrint?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={`rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/20 p-3 ${forPrint ? "print:p-4" : ""}`}
      >
        <div
          className={`font-bold uppercase tracking-wider text-[var(--text-muted)] ${forPrint ? "text-xs print:text-sm" : "text-[10px]"}`}
        >
          {title}
        </div>
        <p className={`mt-2 text-[var(--text-muted)] ${forPrint ? "text-sm print:text-base" : "text-xs"}`}>
          No hitter met the PA threshold in this split.
        </p>
      </div>
    );
  }
  const th = forPrint
    ? "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--text)] print:px-4 print:py-3 print:text-xs"
    : "py-1 pr-2 font-semibold uppercase tracking-wider";
  const td = forPrint
    ? "px-3 py-2.5 text-[var(--text)] print:px-4 print:py-2.5 print:text-sm"
    : "py-1 pr-2";
  return (
    <div
      className={`min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/20 p-3 ${forPrint ? "print:p-4 print:max-w-4xl" : ""}`}
      style={forPrint ? { breakInside: "avoid" as const } : undefined}
    >
      <div
        className={`font-bold uppercase tracking-wider text-[var(--text-muted)] ${forPrint ? "text-xs print:text-sm print:mb-3" : "text-[10px]"}`}
      >
        {title}
      </div>
      <div className="mt-2 overflow-x-auto print:overflow-visible">
        <table className={`w-full border-collapse text-left ${forPrint ? "text-sm print:text-[15px]" : "text-xs"}`}>
          <thead>
            <tr className={`border-b-2 border-[var(--border)] ${forPrint ? "bg-[var(--bg-elevated)]" : ""}`}>
              <th className={`${th} text-left`}>Hitter</th>
              <th className={`${th} text-right tabular-nums`}>PA</th>
              <th className={`${th} text-right font-display tabular-nums`}>OPS</th>
              <th className={`${th} text-right font-display tabular-nums`}>OBP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className={`border-b border-[var(--border)] ${forPrint ? "even:bg-[var(--bg-elevated)]/35" : "border-b border-[var(--border)]/80"}`}
              >
                <td className={`${td} font-semibold text-[var(--text)] print:font-bold`}>{r.name}</td>
                <td className={`${td} text-right tabular-nums`}>{r.pa}</td>
                <td className={`${td} text-right font-display tabular-nums font-semibold`}>{fmt3(r.ops)}</td>
                <td className={`${td} text-right font-display tabular-nums`}>{fmt3(r.obp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoachHittingNotesSection({ notes, forPrint = false }: { notes: PreGameCoachHittingNotes; forPrint?: boolean }) {
  return (
    <section
      className={`scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 ${forPrint ? "print:rounded-lg print:border-2 print:p-8 print:shadow-none" : ""}`}
    >
      <h3
        className={`font-display font-semibold text-[var(--text)] ${forPrint ? "text-base print:text-2xl print:tracking-tight" : "text-base"}`}
      >
        Two-strike approach & contact
      </h3>
      <p className={`mt-1 text-[var(--text-faint)] ${forPrint ? "text-sm print:text-base print:text-[var(--text-muted)]" : "text-xs"}`}>
        {notes.windowLabel}
      </p>

      <div className={`mt-4 ${forPrint ? "" : "max-w-md"}`}>
        {forPrint ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)] print:text-sm print:mb-2">
              Team · final count 2+ strikes
            </p>
            <TwoStrikeTeamPrintTiles line={notes.twoStrikeTeam} />
          </>
        ) : (
          <SituationalTeamCard title="Team · final count 2+ strikes" line={notes.twoStrikeTeam} />
        )}
      </div>
      <p
        className={`mt-3 leading-snug text-[var(--text-muted)] ${forPrint ? "text-sm print:text-base print:max-w-3xl print:leading-relaxed" : "text-[10px]"}`}
      >
        Two-strike uses the PA&apos;s final ball–strike count (includes 3-2 strikeouts and two-strike balls in play).
      </p>

      <div className={`mt-5 ${forPrint ? "" : "max-w-xl"}`}>
        <SituationalHittersTable
          title="Hitters · most two-strike PAs (sample)"
          rows={notes.twoStrikeHitters}
          forPrint={forPrint}
        />
      </div>

      {notes.contact ? (
        <div
          className={`mt-5 border-t border-[var(--border)] pt-5 ${forPrint ? "print:mt-8 print:pt-8 print:border-t-2" : ""}`}
          style={forPrint ? { breakInside: "avoid" as const } : undefined}
        >
          <h4
            className={`font-display font-semibold text-[var(--text)] ${forPrint ? "text-sm print:text-xl" : "text-sm"}`}
          >
            Contact
          </h4>
          <p
            className={`mt-2 text-[var(--text-muted)] ${forPrint ? "text-sm print:text-base print:leading-relaxed" : "mt-1 text-[11px]"}`}
          >
            {notes.contact.teamPa} team PA in window
            {notes.contact.gidp > 0 ? ` · ${notes.contact.gidp} GIDP` : ""}
            {notes.contact.bipWithType > 0 ? ` · ${notes.contact.bipWithType} BIP with type` : ""}
            .
          </p>
          <ContactMixStrip contact={notes.contact} forPrint={forPrint} />
        </div>
      ) : null}
    </section>
  );
}

const MIN_PITCH_FINAL_COUNT_PRINT = 3;

function PitchMixPrintSection({
  rows,
  className,
}: {
  rows: PreGamePitchMixRow[];
  /** Optional wrapper e.g. `mt-6` when shown outside the rates block. */
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="font-display text-sm font-semibold text-[var(--text)]">Pitch mix</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Pitch
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Usage
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Strike%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Whiff%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                n
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b border-[var(--border)]">
                <td
                  className="px-2 py-3 text-center text-[11px] leading-snug text-[var(--text-muted)]"
                  colSpan={5}
                >
                  No pitch-tracked throws in this sample (layout preview).
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--border)]">
                  <td className="px-2 py-1.5 text-left font-medium text-[var(--text)]">{row.label}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                    {pct1(row.usagePct)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                    {pct1(row.strikePct)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                    {pct1(row.whiffPct)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text-muted)]">
                    {row.pitches}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtPitchDec(n: number | undefined | null, digits: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtPitchDecimal(n, digits);
}

/** Single stat tile — matches {@link ContactMixStrip} batter styling (border-l + tinted fill + print colors). */
function PitchingRateTile({
  label,
  value,
  screen,
  printAccent,
}: {
  label: string;
  value: string;
  screen: string;
  printAccent: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] border-l-4 px-3 py-2.5 text-center ${screen} ${printAccent} print:border-2 print:border-slate-300 print:px-4 print:py-3`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-90 print:text-xs">{label}</div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums leading-none print:text-2xl print:mt-1.5">
        {value}
      </div>
    </div>
  );
}

/** Prominent color-coded pitcher rates (mirrors team {@link ContactMixStrip} tiles). */
function PitchingRatesProcessBlock({ rates }: { rates: PitchingRateLine }) {
  const emerald =
    "border-l-emerald-600 dark:border-l-emerald-400 bg-emerald-100/85 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100";
  const emeraldPrint = "print:border-l-emerald-700 print:bg-emerald-50 print:text-slate-900";
  const amber =
    "border-l-amber-600 dark:border-l-amber-400 bg-amber-100/85 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100";
  const amberPrint = "print:border-l-amber-700 print:bg-amber-50 print:text-slate-900";
  const sky =
    "border-l-sky-600 dark:border-l-sky-400 bg-sky-100/85 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100";
  const skyPrint = "print:border-l-sky-700 print:bg-sky-50 print:text-slate-900";
  const violet =
    "border-l-violet-600 dark:border-l-violet-400 bg-violet-100/85 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100";
  const violetPrint = "print:border-l-violet-700 print:bg-violet-50 print:text-slate-900";

  return (
    <div
      className="rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)]/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] print:border-[var(--accent)] print:bg-gradient-to-b print:from-amber-50/80 print:to-white print:p-6 print:shadow-none"
      style={{ breakInside: "avoid" as const }}
    >
      <h3 className="font-display text-base font-bold uppercase tracking-[0.14em] text-[var(--accent)] print:text-xl">
        Rates and process
      </h3>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-5">
        <div
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/35 p-4 print:border-2 print:bg-white print:p-5"
          style={{ breakInside: "avoid" as const }}
        >
          <h4 className="border-b border-[var(--border)] pb-2 font-display text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)] print:text-sm">
            Core
          </h4>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 print:mt-4 print:gap-y-5">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">K%</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{pct1(rates.kPct)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">BB%</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{pct1(rates.bbPct)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">K/9</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{fmtPitchDec(rates.k7, 1)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">BB/9</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{fmtPitchDec(rates.bb7, 1)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">H/9</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{fmtPitchDec(rates.h7, 1)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] print:text-xs">HR/9</dt>
              <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-[var(--text)] print:text-2xl">{fmtPitchDec(rates.hr7, 1)}</dd>
            </div>
          </dl>
        </div>

        <div
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/35 p-4 print:border-2 print:bg-white print:p-5"
          style={{ breakInside: "avoid" as const }}
        >
          <h4 className="border-b border-[var(--border)] pb-2 font-display text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)] print:text-sm">
            Pitch log
          </h4>
          <table className="mt-3 w-full table-fixed border-collapse text-sm print:mt-4 print:text-base">
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[48%]" />
            </colgroup>
            <tbody className="divide-y divide-[var(--border)]/80">
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  P/PA
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.pPa != null && Number.isFinite(rates.pPa) ? fmtDecimalNoLeadingZero(rates.pPa, 1) : "—"}
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  Strike%
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.strikePct != null ? pct1(rates.strikePct) : "—"}
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  FPS%
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.fpsPct != null ? pct1(rates.fpsPct) : "—"}
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  Swing%
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.swingPct != null ? pct1(rates.swingPct) : "—"}
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  Whiff%
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.whiffPct != null ? pct1(rates.whiffPct) : "—"}
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left font-normal tabular-nums text-[var(--text-muted)] print:py-3"
                >
                  Foul%
                </th>
                <td className="py-2.5 text-right font-display font-semibold tabular-nums text-[var(--text)] print:py-3">
                  {rates.foulPct != null ? pct1(rates.foulPct) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {rates.gbPct != null || rates.ldPct != null || rates.fbPct != null || rates.iffPct != null ? (
        <>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent)] print:text-sm print:mb-2">
            BIP mix (tagged)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 print:gap-3">
            <PitchingRateTile
              label="GB%"
              value={rates.gbPct != null ? pct1(rates.gbPct) : "—"}
              screen={emerald}
              printAccent={emeraldPrint}
            />
            <PitchingRateTile
              label="LD%"
              value={rates.ldPct != null ? pct1(rates.ldPct) : "—"}
              screen={amber}
              printAccent={amberPrint}
            />
            <PitchingRateTile
              label="FB%"
              value={rates.fbPct != null ? pct1(rates.fbPct) : "—"}
              screen={sky}
              printAccent={skyPrint}
            />
            <PitchingRateTile
              label="IFFB%"
              value={rates.iffPct != null ? pct1(rates.iffPct) : "—"}
              screen={violet}
              printAccent={violetPrint}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** G / GS / IP / … / FIP line — used for season totals and window sample on the print pitcher page. */
function PitchingLineSampleTable({
  title,
  o,
  description,
}: {
  title: string;
  o: PitchingStats;
  description?: string | null;
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[var(--text)]">{title}</h3>
      {description ? (
        <p className="mt-1 text-[10px] text-[var(--text-muted)] print:text-xs">{description}</p>
      ) : null}
      <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                G
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                GS
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                IP
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                H
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                BAA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                R
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                ER
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                BB
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                SO
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                SV
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                HR
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                HBP
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                WHIP
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                ERA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                FIP
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.g}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.gs}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums font-semibold text-[var(--text)]">
                {o.ipDisplay}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.h}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{fmtBaaAgainst(o)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.r}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.er}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.bb}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.so}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                {o.sv != null ? o.sv : "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.hr}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{o.hbp}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{fmtPitchDec(o.whip, 2)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{fmtPitchDec(o.era, 2)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{fmtPitchDec(o.fip, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Shared columns for platoon splits + runner-situation pitching rows (PA through pitch-log rates). */
const PITCHING_EXT_SPLIT_NUM_TD =
  "whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]";

function pitchingExtendedSplitStatCells(line: PitchingStats | null | undefined): ReactNode {
  if (!line || (line.rates?.pa ?? 0) < 1) {
    return (
      <td className="px-2 py-1.5 text-right font-display tabular-nums text-[var(--text-muted)]" colSpan={18}>
        —
      </td>
    );
  }
  const r = line.rates;
  const num = PITCHING_EXT_SPLIT_NUM_TD;
  return (
    <>
      <td className={num}>{r.pa}</td>
      <td className={num}>{line.h}</td>
      <td className={num}>{fmtBaaAgainst(line)}</td>
      <td className={num}>{line.r}</td>
      <td className={num}>{line.er}</td>
      <td className={num}>{line.bb}</td>
      <td className={num}>{line.so}</td>
      <td className={num}>{line.sv != null ? line.sv : "—"}</td>
      <td className={num}>{fmtPitchDec(line.whip, 2)}</td>
      <td className={num}>{fmtPitchDec(line.era, 2)}</td>
      <td className={num}>{pct1(r.kPct)}</td>
      <td className={num}>{pct1(r.bbPct)}</td>
      <td className={num}>
        {r.pPa != null && Number.isFinite(r.pPa) ? fmtDecimalNoLeadingZero(r.pPa, 1) : "—"}
      </td>
      <td className={num}>{r.strikePct != null ? pct1(r.strikePct) : "—"}</td>
      <td className={num}>{r.fpsPct != null ? pct1(r.fpsPct) : "—"}</td>
      <td className={num}>{r.swingPct != null ? pct1(r.swingPct) : "—"}</td>
      <td className={num}>{r.whiffPct != null ? pct1(r.whiffPct) : "—"}</td>
      <td className={num}>{r.foulPct != null ? pct1(r.foulPct) : "—"}</td>
    </>
  );
}

function pitchingPlatoonRow(label: string, line: PitchingStats | null | undefined) {
  return (
    <tr key={label} className="border-b border-[var(--border)]">
      <td className="px-2 py-1.5 text-left font-medium text-[var(--text)]">{label}</td>
      {pitchingExtendedSplitStatCells(line)}
    </tr>
  );
}

function PitchingPlatoonSplitsTable({
  title,
  description,
  rows,
}: {
  title: string;
  description?: string | null;
  rows: { label: string; line: PitchingStats | null | undefined }[];
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[var(--text)]">{title}</h3>
      {description ? (
        <p className="mt-1 text-[10px] text-[var(--text-muted)] print:text-xs">{description}</p>
      ) : null}
      <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Split
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                PA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                H
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                BAA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                R
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                ER
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                BB
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                SO
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                SV
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                WHIP
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                ERA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                K%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                BB%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                P/PA
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Strike%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                FPS%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Swing%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Whiff%
              </th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                Foul%
              </th>
            </tr>
          </thead>
          <tbody>{rows.map(({ label, line }) => pitchingPlatoonRow(label, line))}</tbody>
        </table>
      </div>
    </div>
  );
}

function PreGamePitchingPlanPrintSection({
  pitchingPlan,
}: {
  pitchingPlan: NonNullable<PreGameReportSections["pitchingPlan"]>;
}) {
  const st = pitchingPlan.starterWindowPitching;
  const o = st?.overall;
  const showSeasonHandedness =
    pitchingPlan.seasonStarterLine != null ||
    (pitchingPlan.seasonStarterVsLHB?.rates?.pa ?? 0) >= 1 ||
    (pitchingPlan.seasonStarterVsRHB?.rates?.pa ?? 0) >= 1;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 print:break-before-page">
      <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)] print:text-xl">
        {pitchingPlan.starterName ?? "—"}
      </h2>
      {pitchingPlan.lastStartVersus || pitchingPlan.lastStartStatLine ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)] print:text-xs">
            Last start — most recent game pitched
          </p>
          {pitchingPlan.lastStartVersus ? (
            <p className="text-base font-semibold leading-snug text-[var(--text)] sm:text-lg print:text-lg print:leading-snug">
              {pitchingPlan.lastStartVersus}
            </p>
          ) : null}
          {pitchingPlan.lastStartStatLine ? (
            <p className="font-display text-lg font-bold tabular-nums leading-snug text-[var(--text)] sm:text-xl print:text-2xl print:leading-relaxed">
              {pitchingPlan.lastStartStatLine}
            </p>
          ) : null}
        </div>
      ) : null}

      {pitchingPlan.planNotes ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40 px-3 py-2.5 print:border-2">
          <p className="text-sm leading-relaxed text-[var(--text)]">{pitchingPlan.planNotes}</p>
        </div>
      ) : null}

      {o && (o.rates?.pa ?? 0) >= 1 ? (
        <div className="mt-5 space-y-4">
          <PitchingRatesProcessBlock rates={o.rates} />

          {pitchingPlan.seasonStarterLine ? (
            <PitchingLineSampleTable
              title="Season"
              o={pitchingPlan.seasonStarterLine}
              description="Full season totals"
            />
          ) : null}

          {showSeasonHandedness ? (
            <PitchingPlatoonSplitsTable
              title="Season vs LHB / RHB"
              description="Full season; L/R batters only (switch hitters excluded from platoon buckets)."
              rows={[
                { label: "vs LHB", line: pitchingPlan.seasonStarterVsLHB },
                { label: "vs RHB", line: pitchingPlan.seasonStarterVsRHB },
              ]}
            />
          ) : null}

          {st?.runnerSituations ? (
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text)]">Runner situation</h3>
              <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Situation
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        PA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        H
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        BAA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        R
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        ER
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        BB
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        SO
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        SV
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        WHIP
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        ERA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        K%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        BB%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        P/PA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        Strike%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        FPS%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        Swing%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        Whiff%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        Foul%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Bases empty", st.runnerSituations.basesEmpty.combined],
                        ["Runners on", st.runnerSituations.runnersOn.combined],
                        ["RISP", st.runnerSituations.risp.combined],
                        ["Bases loaded", st.runnerSituations.basesLoaded.combined],
                      ] as const
                    ).map(([label, line]) => (
                      <tr key={label} className="border-b border-[var(--border)]">
                        <td className="px-2 py-1.5 text-left font-medium text-[var(--text)]">{label}</td>
                        {pitchingExtendedSplitStatCells(line)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {st?.statsByFinalCount?.overall ? (
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text)]">By final count</h3>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Rows with at least {MIN_PITCH_FINAL_COUNT_PRINT} PA only.</p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Count
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        PA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        ERA
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        K%
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                        BB%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FINAL_COUNT_PAIRS.map(([b, s]) => {
                      const key = finalCountBucketKey(b, s);
                      const row = st.statsByFinalCount!.overall[key];
                      const pa = row?.rates?.pa ?? 0;
                      if (!row || pa < MIN_PITCH_FINAL_COUNT_PRINT) return null;
                      return (
                        <tr key={key} className="border-b border-[var(--border)]">
                          <td className="px-2 py-1.5 text-left font-medium text-[var(--text)]">{key}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                            {pa}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                            {fmtPitchDec(row.era, 2)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                            {pct1(row.rates.kPct)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">
                            {pct1(row.rates.bbPct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <PitchMixPrintSection rows={pitchingPlan.pitchMix} />
        </div>
      ) : null}

      {!o || (o.rates?.pa ?? 0) < 1 ? (
        <PitchMixPrintSection rows={pitchingPlan.pitchMix} className="mt-6" />
      ) : null}
    </section>
  );
}

export function PreGameReport({
  game,
  roster,
  statsByPlayerId,
  overview,
}: {
  game: Game;
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
  overview: PreGameOverviewPayload | null;
}) {
  const batters = useMemo(() => roster.filter((p) => !isPitcherPlayer(p)), [roster]);

  const ourSpId =
    game.our_side === "home" ? game.starting_pitcher_home_id ?? null : game.starting_pitcher_away_id ?? null;
  const oppSpId =
    game.our_side === "home" ? game.starting_pitcher_away_id ?? null : game.starting_pitcher_home_id ?? null;

  const ourSp = ourSpId ? resolvePlayer(ourSpId, overview, roster) : undefined;
  const oppSp = oppSpId ? resolvePlayer(oppSpId, overview, roster) : undefined;
  const oppThrows = oppSp?.throws ?? null;

  const ourLineup = overview?.ourLineup ?? [];
  const rep = overview?.report;
  const lineupStatsMap = overview?.lineupStatsByPlayerId;
  const ourStarterSummary = overview?.ourStarterSummary ?? null;

  const lineupPlayerIds = useMemo(() => new Set(ourLineup.map((r) => r.player_id)), [ourLineup]);
  const ourBench = useMemo(
    () =>
      roster
        .filter((p) => isActiveRosterPlayer(p) && !lineupPlayerIds.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [roster, lineupPlayerIds]
  );

  const platoonPrintRows = useMemo(() => {
    return batters
      .map((p) =>
        platoonVsStarterLeaderboardRow(p, statsByPlayerId[p.id] ?? lineupStatsMap?.[p.id], oppThrows)
      )
      .sort((a, b) => {
        const ak = Number.isFinite(a.sortOps) ? a.sortOps : -1;
        const bk = Number.isFinite(b.sortOps) ? b.sortOps : -1;
        if (bk !== ak) return bk - ak;
        if (b.pa !== a.pa) return b.pa - a.pa;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }, [batters, statsByPlayerId, lineupStatsMap, oppThrows]);

  const rispSortedRows = useMemo(() => {
    const windowRispById = overview?.pregameWindowRispStatsByPlayerId;
    const rispAllRows = batters
      .map((p) => {
        if (windowRispById) {
          const wr = windowRispById[p.id];
          if (!wr) return null;
          return rispCompactRow(p, { risp: wr } as BattingStatsWithSplits);
        }
        return rispCompactRow(p, statsByPlayerId[p.id] ?? lineupStatsMap?.[p.id]);
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    return [...rispAllRows].sort((a, b) => {
      const ao = Number.isFinite(Number(a.opsDisplay)) ? Number(a.opsDisplay) : -1;
      const bo = Number.isFinite(Number(b.opsDisplay)) ? Number(b.opsDisplay) : -1;
      if (bo !== ao) return bo - ao;
      if (b.pa !== a.pa) return b.pa - a.pa;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [batters, statsByPlayerId, lineupStatsMap, overview?.pregameWindowRispStatsByPlayerId]);

  const seasonAvgLine = (playerId: string): { avg: string; ops: string; paNote: string } => {
    const s = statsByPlayerId[playerId]?.overall ?? lineupStatsMap?.[playerId]?.overall;
    const pa = s?.pa ?? 0;
    return {
      avg: fmtSeason(s?.avg),
      ops: fmtSeason(s?.ops),
      paNote: pa >= 1 ? `${pa} PA` : "",
    };
  };

  return (
    <div className="space-y-8 print:space-y-0">
      <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)] print:hidden">
        On-screen preview of the pre-game PDF. Use your browser&apos;s Print dialog and choose &quot;Save as PDF&quot; to
        export the same layout.
      </p>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">{matchupLabelUsFirst(game, true)}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {formatDateMMDDYYYY(game.date)} · {ourVenueLabel(game)} · Logged season AVG / OPS / PA
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
              Starters
            </h2>
            <ul className="mt-3 space-y-2.5">
              {ourLineup.map((row) => {
                const p = resolvePlayer(row.player_id, overview, roster);
                const pos =
                  row.position?.trim() || p?.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
                const jersey = p?.jersey?.trim() || "—";
                const bat = batsAbbr(p?.bats);
                const st = seasonAvgLine(row.player_id);
                return (
                  <li key={`print-our-${row.slot}-${row.player_id}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {row.slot}. {p?.name ?? "Unknown"}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        #{jersey} · {pos}
                        {bat !== "—" ? ` · ${bat}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text)]">
                      AVG {st.avg} · OPS {st.ops}
                      {st.paNote ? ` · ${st.paNote}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-[var(--border)] pt-3 px-1 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Starting pitcher</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{ourStarterSummary?.name ?? "—"}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    #{ourSp?.jersey?.trim() || "—"} · {pitcherHandLabel(ourSp?.throws ?? null)}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text)]">
                  ERA {ourStarterSummary?.seasonEra ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">Bench</h2>
            {ourBench.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {ourBench.map((p) => {
                  const pos = p.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
                  const jersey = p.jersey?.trim() || "—";
                  const bat = batsAbbr(p.bats);
                  const st = seasonAvgLine(p.id);
                  return (
                    <li key={`print-bench-${p.id}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)]">{p.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          #{jersey} · {pos}
                          {bat !== "—" ? ` · ${bat}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text)]">
                        AVG {st.avg} · OPS {st.ops}
                        {st.paNote ? ` · ${st.paNote}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No bench hitters outside the lineup.</p>
            )}
          </div>
        </div>
      </section>

      {rep?.pitchingPlan ? <PreGamePitchingPlanPrintSection pitchingPlan={rep.pitchingPlan} /> : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 print:break-before-page">
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Platoon splits</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Hitter
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  PA
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  H-AB
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  P/PA
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  OPS
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  wOBA
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  AVG/OBP/SLG
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  K%
                </th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                  BB%
                </th>
              </tr>
            </thead>
            <tbody>
              {platoonPrintRows.map((row) => {
                const subMeta = [
                  row.jersey !== "—" ? `#${row.jersey}` : null,
                  row.posLabel !== "—" ? row.posLabel : null,
                  row.bats !== "—" ? row.bats : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const num = "whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]";
                return (
                  <tr key={`print-platoon-${row.playerId}`} className="border-b border-[var(--border)]">
                    <td className="px-2 py-1.5 text-left align-top">
                      <div className="font-medium text-[var(--text)]">{row.name}</div>
                      {subMeta ? (
                        <div className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">{subMeta}</div>
                      ) : null}
                    </td>
                    <td className={num}>{row.pa}</td>
                    <td className={num}>{row.hAbDisplay}</td>
                    <td className={num}>{row.ppaDisplay}</td>
                    <td className={`${num} font-semibold`}>{row.opsDisplay}</td>
                    <td className={`${num} font-semibold`}>{row.wobaDisplay}</td>
                    <td className={`${num} font-semibold`}>{row.slash}</td>
                    <td className={num}>{row.kPctDisplay}</td>
                    <td className={num}>{row.bbPctDisplay}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 print:break-before-page">
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">RISP and situational hitting</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Team row: plate appearances with runners in scoring position only (rates below use that sample).
        </p>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/25 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Team RISP</div>
          {rep?.hittingTrends?.windowLabel ? (
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)] print:text-xs">
              {rep.hittingTrends.windowLabel}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-[var(--text-muted)]">
              PA{" "}
              <span className="font-semibold text-[var(--text)]">
                {rep?.hittingTrends?.season != null &&
                typeof rep.hittingTrends.season.rispPa === "number" &&
                Number.isFinite(rep.hittingTrends.season.rispPa)
                  ? rep.hittingTrends.season.rispPa
                  : "—"}
              </span>
            </span>
            <span className="text-[var(--text-muted)]">H-AB <span className="font-semibold text-[var(--text)]">{rep?.hittingTrends?.season?.rispHab ?? "—"}</span></span>
            <span className="text-[var(--text-muted)]">
              P/PA{" "}
              <span className="font-semibold text-[var(--text)]">
                {rep?.hittingTrends?.season?.rispPpa != null && Number.isFinite(rep.hittingTrends.season.rispPpa)
                  ? rep.hittingTrends.season.rispPpa.toFixed(1)
                  : "—"}
              </span>
            </span>
            <span className="text-[var(--text-muted)]">
              OPS{" "}
              <span className="font-semibold text-[var(--text)]">
                {rep?.hittingTrends?.season?.rispOps != null ? fmtSeason(rep.hittingTrends.season.rispOps) : "—"}
              </span>
            </span>
            <span className="text-[var(--text-muted)]">
              AVG/OBP/SLG{" "}
              <span className="font-semibold text-[var(--text)]">{rispSlashDisplay(rep?.hittingTrends?.season?.rispSlash ?? "—").replace(/\s*\(\d+\sPA\)\s*$/, "")}</span>
            </span>
            <span className="text-[var(--text-muted)]">
              K%{" "}
              <span className="font-semibold text-[var(--text)]">
                {rep?.hittingTrends?.season?.rispKPct != null ? pct1(rep.hittingTrends.season.rispKPct) : "—"}
              </span>
            </span>
            <span className="text-[var(--text-muted)]">
              BB%{" "}
              <span className="font-semibold text-[var(--text)]">
                {rep?.hittingTrends?.season?.rispBbPct != null ? pct1(rep.hittingTrends.season.rispBbPct) : "—"}
              </span>
            </span>
          </div>
        </div>

        {rispSortedRows.length > 0 ? (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Hitter
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      PA
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      H-AB
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      P/PA
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      OPS
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      AVG/OBP/SLG
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      K%
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-display text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)] print:text-xs">
                      BB%
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rispSortedRows.map((row) => {
                    const num = "whitespace-nowrap px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]";
                    return (
                      <tr key={`print-risp-backup-${row.playerId}`} className="border-b border-[var(--border)]">
                        <td className="px-2 py-1.5 text-left font-medium text-[var(--text)]">{row.name}</td>
                        <td className={num}>{row.pa}</td>
                        <td className={num}>{row.hAbDisplay}</td>
                        <td className={num}>{row.ppaDisplay}</td>
                        <td className={`${num} font-semibold`}>{row.opsDisplay}</td>
                        <td className={num}>{row.slash}</td>
                        <td className={num}>{row.kPctDisplay}</td>
                        <td className={num}>{row.bbPctDisplay}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-[var(--text-muted)] print:text-xs">
              Every roster batter with at least one RISP PA in this window (same sample as the team row above), sorted by
              RISP OPS then PA.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">No logged RISP plate appearances yet.</p>
        )}
      </section>

      {rep?.coachHittingNotes ? (
        <div className="print:break-before-page">
          <CoachHittingNotesSection notes={rep.coachHittingNotes} forPrint />
        </div>
      ) : null}
    </div>
  );
}
