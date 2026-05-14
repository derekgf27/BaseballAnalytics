"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { PlayerSprayChartsSection } from "@/components/analyst/PlayerSprayChartsSection";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { BattingStats, BattingStatsWithSplits, Player } from "@/lib/types";

function fmt3(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtDecimalNoLeadingZero(n, 3);
}

function fmtPct(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function fmtCount(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.trunc(n));
}

/** Season line: compact label tucked beside the number so the figure reads first. */
function SeasonStatPair({ abbr, val }: { abbr: string; val: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-faint)] print:text-[10px]">
        {abbr}
      </span>
      <span className="font-display text-xl font-bold tabular-nums leading-none text-[var(--text)] print:text-2xl">
        {val}
      </span>
    </span>
  );
}

/** Percent display — matches {@link PreGameReport} `pct1` / `PitchingRateTile` BIP mix. */
function pct1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

/**
 * BIP mix as compact rows (label / value) — same border + left accent + tint as pre-game tiles,
 * but laid out for quick scanning in a grid.
 */
function BipMixRow({
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
      className={`flex min-h-[3rem] items-center justify-between gap-3 rounded-lg border border-[var(--border)] border-l-4 px-3 py-2.5 ${screen} ${printAccent} print:border-2 print:border-slate-300 print:px-4 print:py-3`}
    >
      <span className="text-left text-xs font-semibold leading-tight print:text-sm">{label}</span>
      <span className="shrink-0 font-display text-lg font-bold tabular-nums leading-none print:text-2xl">
        {value}
      </span>
    </div>
  );
}

const BIP_EMERALD =
  "border-l-emerald-600 dark:border-l-emerald-400 bg-emerald-100/85 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100";
const BIP_EMERALD_PRINT = "print:border-l-emerald-700 print:bg-emerald-50 print:text-slate-900";
const BIP_AMBER =
  "border-l-amber-600 dark:border-l-amber-400 bg-amber-100/85 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100";
const BIP_AMBER_PRINT = "print:border-l-amber-700 print:bg-amber-50 print:text-slate-900";
const BIP_SKY =
  "border-l-sky-600 dark:border-l-sky-400 bg-sky-100/85 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100";
const BIP_SKY_PRINT = "print:border-l-sky-700 print:bg-sky-50 print:text-slate-900";
const BIP_VIOLET =
  "border-l-violet-600 dark:border-l-violet-400 bg-violet-100/85 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100";
const BIP_VIOLET_PRINT = "print:border-l-violet-700 print:bg-violet-50 print:text-slate-900";

function DisciplineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)]/50 py-2.5 text-sm last:border-b-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="shrink-0 tabular-nums font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}

function PlatoonRispTable({
  rows,
}: {
  rows: { label: string; st: BattingStats | null | undefined }[];
}) {
  const thCount =
    "whitespace-nowrap px-1.5 py-2.5 text-right text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]";
  const thSlash = `${thCount} min-w-[2.5rem]`;
  const td = "px-1.5 py-2.5 tabular-nums text-[var(--text)]";
  const tdFirst = "px-3 py-2.5 font-medium text-[var(--text)]";

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-base)]/40">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/60 text-left">
            <th className="sticky left-0 z-[1] bg-[var(--bg-elevated)]/95 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-sm print:static print:bg-transparent">
              Split
            </th>
            <th className={thCount}>PA</th>
            <th className={thCount}>AB</th>
            <th className={thCount}>H</th>
            <th className={thCount}>2B</th>
            <th className={thCount}>3B</th>
            <th className={thCount}>HR</th>
            <th className={thCount}>RBI</th>
            <th className={thCount}>BB</th>
            <th className={thCount}>K</th>
            <th className={thCount}>SF</th>
            <th className={thCount}>SH</th>
            <th className={thCount}>GIDP</th>
            <th className={thSlash}>AVG</th>
            <th className={thSlash}>OBP</th>
            <th className={thSlash}>SLG</th>
            <th className={thSlash}>OPS</th>
            <th className={thCount}>K%</th>
            <th className={`${thCount} px-3`}>BB%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, st }) => {
            const pav = st?.pa ?? 0;
            const has = pav > 0;
            const dash = "—";
            return (
              <tr key={label} className="border-b border-[var(--border)]/50 last:border-b-0">
                <td className={`${tdFirst} sticky left-0 z-[1] bg-[var(--bg-card)] backdrop-blur-sm print:static print:bg-transparent`}>
                  {label}
                </td>
                <td className={`${td} text-right`}>{has ? pav : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.ab) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.h) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.double) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.triple) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.hr) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.rbi) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.bb) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.so) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.sf) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.sh) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtCount(st?.gidp) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmt3(st?.avg) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmt3(st?.obp) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmt3(st?.slg) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmt3(st?.ops) : dash}</td>
                <td className={`${td} text-right`}>{has ? fmtPct(st?.kPct ?? 0) : dash}</td>
                <td className={`${td} px-3 text-right`}>{has ? fmtPct(st?.bbPct ?? 0) : dash}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PlayerReportsTab({
  roster,
  statsByPlayerId,
  sprayByPlayerId: sprayByPlayerIdProp,
  disciplineExtraByPlayerId: disciplineExtraByPlayerIdProp,
}: {
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
  /** May be missing on stale RSC payload / HMR — default {}. */
  sprayByPlayerId?: Record<string, AnalystPlayerSpraySplits | null>;
  disciplineExtraByPlayerId?: Record<string, { strikePct: number | null; fpsPct: number | null }>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sprayByPlayerId = sprayByPlayerIdProp ?? {};
  const disciplineExtraByPlayerId = disciplineExtraByPlayerIdProp ?? {};

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)] print:hidden">
        Tap a player to expand. Season stats from logged PAs (same engine as the roster profile). Spray charts use
        tagged hit direction on balls in play; discipline rates use pitch logs when present.
      </p>
      {openId == null ? (
        <p className="hidden rounded-lg border border-slate-300 bg-amber-50 px-4 py-3 text-center text-sm text-slate-800 print:block">
          Expand a player in the list before exporting — the PDF includes only that player&apos;s name and stats.
        </p>
      ) : null}
      <ul className="space-y-2">
        {roster.map((p) => {
          const s = statsByPlayerId[p.id];
          const o = s?.overall;
          const open = openId === p.id;
          const pa = o?.pa ?? 0;
          const extra = disciplineExtraByPlayerId[p.id] ?? { strikePct: null, fpsPct: null };
          const spray = sprayByPlayerId[p.id] ?? null;
          const isSwitch = p.bats === "S";
          const hasBipMix =
            !!o && (o.gbPct != null || o.ldPct != null || o.fbPct != null || o.iffPct != null);
          /** PDF / print: only the expanded row is visible; requires a player to be open first. */
          const hideInPrint = openId === null || p.id !== openId;

          return (
            <li
              key={p.id}
              className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] transition hover:border-[var(--accent)]/40 ${hideInPrint ? "print:hidden" : "print:break-inside-avoid print:rounded-lg print:border-2 print:border-slate-300 print:shadow-none"}`}
            >
              <div className="print:hidden">
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
              </div>
              <div className="hidden border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-4 print:block print:border-b-2 print:border-slate-200 print:bg-white">
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                  {p.name}
                  {p.jersey ? <span className="text-slate-600"> #{p.jersey}</span> : null}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {pa > 0 ? `${pa} plate appearances · OPS ${fmt3(o?.ops)}` : "No PA yet"}
                </p>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/50 print:!h-auto print:overflow-visible print:!opacity-100 print:border-t-2 print:border-slate-200 print:bg-white"
                  >
                    <div className="space-y-6 p-4">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Season line</h4>
                        {o && pa > 0 ? (
                          <div className="mt-2 space-y-3">
                            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                              {(
                                [
                                  ["AVG", fmt3(o.avg)],
                                  ["OBP", fmt3(o.obp)],
                                  ["SLG", fmt3(o.slg)],
                                  ["OPS", fmt3(o.ops)],
                                ] as const
                              ).map(([abbr, val]) => (
                                <SeasonStatPair key={abbr} abbr={abbr} val={val} />
                              ))}
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-[var(--border)]/50 pt-3">
                              {(
                                [
                                  ["PA", fmtCount(o.pa)],
                                  ["AB", fmtCount(o.ab)],
                                  ["H", fmtCount(o.h)],
                                  ["2B", fmtCount(o.double)],
                                  ["3B", fmtCount(o.triple)],
                                  ["HR", fmtCount(o.hr)],
                                  ["RBI", fmtCount(o.rbi)],
                                  ["BB", fmtCount(o.bb)],
                                  ["K", fmtCount(o.so)],
                                  ["SF", fmtCount(o.sf)],
                                  ["SH", fmtCount(o.sh)],
                                  ["GIDP", fmtCount(o.gidp)],
                                ] as const
                              ).map(([abbr, val]) => (
                                <SeasonStatPair key={abbr} abbr={abbr} val={val} />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 font-display text-xl font-bold tabular-nums text-[var(--text)]">—</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Platoon &amp; RISP
                        </h4>
                        {isSwitch ? (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Switch hitter: rows follow the batting side used vs each pitcher hand.
                          </p>
                        ) : null}
                        <div className="mt-3">
                          <PlatoonRispTable
                            rows={[
                              { label: "vs LHP", st: s?.vsL },
                              { label: "vs RHP", st: s?.vsR },
                              { label: "RISP", st: s?.risp },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                            Plate discipline
                          </h4>
                          <p className="mt-1 text-xs text-[var(--text-faint)]">
                            K/BB and strike / first-pitch strike use PA fields; swing / whiff / foul need pitch-by-pitch
                            logs.
                          </p>
                          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]/40 px-3">
                            <DisciplineRow label="K%" value={o && pa > 0 ? fmtPct(o.kPct ?? 0) : "—"} />
                            <DisciplineRow label="BB%" value={o && pa > 0 ? fmtPct(o.bbPct ?? 0) : "—"} />
                            <DisciplineRow
                              label="Strike % (strikes ÷ pitches)"
                              value={extra.strikePct != null ? fmtPct(extra.strikePct) : "—"}
                            />
                            <DisciplineRow
                              label="First-pitch strike %"
                              value={extra.fpsPct != null ? fmtPct(extra.fpsPct) : "—"}
                            />
                            <DisciplineRow
                              label="Swing %"
                              value={o?.swingPct != null ? fmtPct(o.swingPct) : "—"}
                            />
                            <DisciplineRow
                              label="Whiff % (of swings)"
                              value={o?.whiffPct != null ? fmtPct(o.whiffPct) : "—"}
                            />
                            <DisciplineRow
                              label="Foul % (of pitches logged)"
                              value={o?.foulPct != null ? fmtPct(o.foulPct) : "—"}
                            />
                            <DisciplineRow
                              label="Pitches / PA"
                              value={o?.pPa != null ? o.pPa.toFixed(2) : "—"}
                            />
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                            Batted ball type %
                          </h4>
                          <p className="mt-1 text-xs text-[var(--text-faint)]">
                            Among balls in play with a type on Record. Shares sum to 100% when all BIP are tagged.
                          </p>
                          {hasBipMix && o ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                              <BipMixRow
                                label="Ground ball"
                                value={pct1(o.gbPct)}
                                screen={BIP_EMERALD}
                                printAccent={BIP_EMERALD_PRINT}
                              />
                              <BipMixRow
                                label="Line drive"
                                value={pct1(o.ldPct)}
                                screen={BIP_AMBER}
                                printAccent={BIP_AMBER_PRINT}
                              />
                              <BipMixRow
                                label="Fly ball"
                                value={pct1(o.fbPct)}
                                screen={BIP_SKY}
                                printAccent={BIP_SKY_PRINT}
                              />
                              <BipMixRow
                                label="Infield fly"
                                value={pct1(o.iffPct)}
                                screen={BIP_VIOLET}
                                printAccent={BIP_VIOLET_PRINT}
                              />
                            </div>
                          ) : (
                            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]/40 py-4 text-center text-sm text-[var(--text-muted)]">
                              — Tag batted-ball type on balls in play to populate this block.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)]/30 p-4 print:hidden">
                        {spray ? (
                          <PlayerSprayChartsSection spraySplits={spray} isSwitch={isSwitch} />
                        ) : (
                          <p className="text-sm text-[var(--text-muted)]">No spray data for this player.</p>
                        )}
                      </div>

                      <div className="print:hidden">
                        <Link
                          href={analystPlayerProfileHref(p.id)}
                          className="inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
                        >
                          Open full analyst profile →
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
