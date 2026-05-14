"use client";

import type { PostGameSnapshot } from "@/lib/reports/postGameSnapshot";
import {
  countHitsBottom,
  countHitsTop,
  sumRunsBottomInning,
  sumRunsTopInning,
  totalErrorsChargedToAway,
  totalErrorsChargedToHome,
  totalRunsBottom,
  totalRunsTop,
} from "@/lib/compute/boxScore";
import { fmtDecimalNoLeadingZero, formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst, ourTeamName } from "@/lib/opponentUtils";
import type { Game, PlateAppearance } from "@/lib/types";

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[var(--border)]/50 py-3 last:border-b-0">
      <span className="min-w-0 text-sm leading-snug text-[var(--text-muted)]">{label}</span>
      <span className="shrink-0 font-display text-lg font-bold tabular-nums text-[var(--text)] sm:text-xl">{value}</span>
    </div>
  );
}

function Panel({
  title,
  kicker,
  children,
}: {
  title?: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/25 p-5 sm:p-6">
      {kicker ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{kicker}</p>
      ) : null}
      {title ? (
        <h3
          className={`font-display text-lg font-semibold tracking-tight text-[var(--text)] ${kicker ? "mt-1" : ""}`}
        >
          {title}
        </h3>
      ) : null}
      <div className={kicker || title ? "mt-3" : ""}>{children}</div>
    </div>
  );
}

function PostGameLinescoreTable({
  game,
  pas,
  inningCount,
}: {
  game: Game;
  pas: PlateAppearance[];
  inningCount: number;
}) {
  const n = Math.max(1, inningCount);
  const innings = Array.from({ length: n }, (_, i) => i + 1);
  const rAway = totalRunsTop(pas);
  const rHome = totalRunsBottom(pas);
  const hAway = countHitsTop(pas);
  const hHome = countHitsBottom(pas);
  const eAway = totalErrorsChargedToAway(pas);
  const eHome = totalErrorsChargedToHome(pas);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-base)]/40">
      <table className="w-full min-w-[260px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/80">
            <th className="sticky left-0 z-[1] border-r border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Team
            </th>
            {innings.map((inn) => (
              <th
                key={inn}
                className="w-9 min-w-[2rem] px-0.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
              >
                {inn}
              </th>
            ))}
            <th className="w-10 min-w-[2.25rem] border-l border-[var(--border)] px-0.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text)]">
              R
            </th>
            <th className="w-10 min-w-[2.25rem] px-0.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text)]">
              H
            </th>
            <th className="w-10 min-w-[2.25rem] px-0.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text)]">
              E
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[var(--border)]/70">
            <td className="sticky left-0 z-[1] border-r border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 font-medium leading-tight text-[var(--text)]">
              <span className="line-clamp-2">{game.away_team}</span>
            </td>
            {innings.map((inn) => (
              <td key={`a-${inn}`} className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">
                {sumRunsTopInning(pas, inn)}
              </td>
            ))}
            <td className="border-l border-[var(--border)] px-0.5 py-2.5 text-center font-display text-base font-bold tabular-nums text-[var(--text)]">
              {rAway}
            </td>
            <td className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">{hAway}</td>
            <td className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">{eAway}</td>
          </tr>
          <tr>
            <td className="sticky left-0 z-[1] border-r border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 font-medium leading-tight text-[var(--text)]">
              <span className="line-clamp-2">{game.home_team}</span>
            </td>
            {innings.map((inn) => (
              <td key={`h-${inn}`} className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">
                {sumRunsBottomInning(pas, inn)}
              </td>
            ))}
            <td className="border-l border-[var(--border)] px-0.5 py-2.5 text-center font-display text-base font-bold tabular-nums text-[var(--text)]">
              {rHome}
            </td>
            <td className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">{hHome}</td>
            <td className="px-0.5 py-2.5 text-center tabular-nums text-[var(--text)]">{eHome}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PostGameReport({
  game,
  data,
  pas,
  analystAddendum,
  onAnalystAddendumChange,
}: {
  game: Game;
  data: PostGameSnapshot;
  pas: PlateAppearance[];
  analystAddendum: string;
  onAnalystAddendumChange: (v: string) => void;
}) {
  const off = data.teamOffense;
  const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
  const us = ourTeamName(game);
  const dateLine = game.date ? formatDateMMDDYYYY(game.date) : null;
  const decisions = data.pitchDecisionsDisplay ?? { winName: null, lossName: null, saveName: null };
  const teamPitchSeen = data.teamPitchSeen ?? null;

  return (
    <div className="space-y-10 print:space-y-6">
      <section className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        {/* Title band */}
        <div
          id="post-header"
          className="scroll-mt-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--accent-dim)]/25 via-transparent to-transparent px-5 py-6 sm:px-8 sm:py-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Post-game report</p>
              <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-[var(--text)] sm:text-3xl">
                {matchupLabelUsFirst(game, true)}
              </h1>
            </div>
            {dateLine ? (
              <p className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm tabular-nums text-[var(--text-muted)]">
                {dateLine}
              </p>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {/* Linescore + team stats: side-by-side on large screens */}
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10 lg:items-start">
            <div className="scroll-mt-6 space-y-6 lg:col-span-7">
              <div id="post-scoring" className="scroll-mt-6 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Linescore</p>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                  <div className="min-w-0 flex-1">
                    <PostGameLinescoreTable game={game} pas={pas} inningCount={data.maxInning} />
                  </div>
                  <aside
                    className="shrink-0 lg:min-w-[10.5rem] lg:border-l lg:border-[var(--border)] lg:pl-6 lg:pt-0.5"
                    aria-label="Pitcher results"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Results</p>
                    <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-[var(--text)]">
                      <p>
                        <span className="text-[var(--text-muted)]">Win</span>
                        <span className="mx-1.5 text-[var(--text-faint)]">—</span>
                        <span className="font-medium">{decisions.winName ?? "—"}</span>
                      </p>
                      <p>
                        <span className="text-[var(--text-muted)]">Loss</span>
                        <span className="mx-1.5 text-[var(--text-faint)]">—</span>
                        <span className="font-medium">{decisions.lossName ?? "—"}</span>
                      </p>
                      {game.save_pitcher_id ? (
                        <p>
                          <span className="text-[var(--text-muted)]">Save</span>
                          <span className="mx-1.5 text-[var(--text-faint)]">—</span>
                          <span className="font-medium">{decisions.saveName ?? "—"}</span>
                        </p>
                      ) : null}
                    </div>
                  </aside>
                </div>
              </div>

              <div id="post-pitching" className="scroll-mt-6 space-y-4">
                <Panel title="Team pitch profile" kicker={`${us} · this game`}>
                  {!off ? (
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                      No plate appearances for {us} — lines below fill in from your club&apos;s PAs and pitch logs.
                    </p>
                  ) : teamPitchSeen == null ? (
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                      Pitch profile isn&apos;t in this snapshot. Tap{" "}
                      <strong className="text-[var(--text)]">Generate Report</strong> again to refresh strike %, whiff %,
                      and usage.
                    </p>
                  ) : (
                    <div>
                      <div className="break-inside-avoid">
                        <StatRow
                          label="Strike %"
                          value={teamPitchSeen.strikePct != null ? fmtPct(teamPitchSeen.strikePct) : "—"}
                          tone="neutral"
                        />
                        <StatRow
                          label="Whiff %"
                          value={teamPitchSeen.whiffPct != null ? fmtPct(teamPitchSeen.whiffPct) : "—"}
                          tone="neutral"
                        />
                        <StatRow
                          label="Foul %"
                          value={teamPitchSeen.foulPct != null ? fmtPct(teamPitchSeen.foulPct) : "—"}
                          tone="neutral"
                        />
                        <p className="pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          Batted ball type %
                        </p>
                        {teamPitchSeen.battedBall ? (
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--border)]/50 bg-[var(--bg-base)]/30 p-3 sm:gap-x-6 sm:p-4">
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs leading-snug text-[var(--text-muted)]">Ground ball</span>
                              <span className="font-display text-lg font-bold tabular-nums text-[var(--text)] sm:text-xl">
                                {fmtPct(teamPitchSeen.battedBall.gbPct)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs leading-snug text-[var(--text-muted)]">Line drive</span>
                              <span className="font-display text-lg font-bold tabular-nums text-[var(--text)] sm:text-xl">
                                {fmtPct(teamPitchSeen.battedBall.ldPct)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs leading-snug text-[var(--text-muted)]">Fly ball</span>
                              <span className="font-display text-lg font-bold tabular-nums text-[var(--text)] sm:text-xl">
                                {fmtPct(teamPitchSeen.battedBall.fbPct)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs leading-snug text-[var(--text-muted)]">Infield fly</span>
                              <span className="font-display text-lg font-bold tabular-nums text-[var(--text)] sm:text-xl">
                                {fmtPct(teamPitchSeen.battedBall.iffPct)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-[var(--text-muted)]">—</p>
                        )}
                      </div>
                      <p className="pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Pitch usage %
                      </p>
                      {teamPitchSeen.pitchUsage.length > 0 ? (
                        <div className="mt-2">
                          {teamPitchSeen.pitchUsage.map((row) => (
                            <StatRow
                              key={row.label}
                              label={row.label}
                              value={fmtPct(row.pct)}
                              tone="neutral"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--text-muted)]">—</p>
                      )}
                    </div>
                  )}
                </Panel>
              </div>
            </div>

            <aside className="flex flex-col gap-6 lg:col-span-5">
              <div id="post-offense" className="scroll-mt-6">
                <Panel title="Offense" kicker="Team · logged PAs">
                  {!off ? (
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                      No plate appearances for {us}. Log PAs on{" "}
                      <strong className="text-[var(--text)]">Record</strong> to fill this panel.
                    </p>
                  ) : (
                    <div>
                      <StatRow label="AVG" value={fmtDecimalNoLeadingZero(off.avg, 3)} />
                      <StatRow label="OBP" value={fmtDecimalNoLeadingZero(off.obp, 3)} />
                      <StatRow
                        label="OPS"
                        value={fmtDecimalNoLeadingZero(off.ops, 3)}
                        tone={off.ops >= 0.75 ? "good" : off.ops < 0.6 ? "bad" : "neutral"}
                      />
                      <StatRow label="Strikeout %" value={fmtPct(off.kPct)} tone={off.kPct > 0.28 ? "bad" : "neutral"} />
                      <StatRow label="Walk %" value={fmtPct(off.bbPct)} tone={off.bbPct > 0.1 ? "good" : "neutral"} />
                      <StatRow
                        label="Pitches seen"
                        value={off.pitchesSeenTotal != null ? String(off.pitchesSeenTotal) : "—"}
                        tone="neutral"
                      />
                      <StatRow
                        label="RISP (hits / opportunities)"
                        value={`${data.situational.rispHits} / ${data.situational.rispPa}`}
                        tone={(() => {
                          const pa = data.situational.rispPa;
                          if (pa < 3) return "neutral";
                          const rate = data.situational.rispHits / pa;
                          if (rate >= 0.35) return "good";
                          if (rate < 0.2) return "bad";
                          return "neutral";
                        })()}
                      />
                    </div>
                  )}
                </Panel>
              </div>

              <div id="post-discipline" className="scroll-mt-6">
                <Panel title="🎯 Plate discipline" kicker="Process">
                  <div>
                    <StatRow
                      label="First pitch strike %"
                      value={data.plateDiscipline.fpsPct != null ? fmtPct(data.plateDiscipline.fpsPct) : "—"}
                      tone={
                        data.plateDiscipline.fpsPct != null && data.plateDiscipline.fpsPct < 0.45
                          ? "bad"
                          : data.plateDiscipline.fpsPct != null && data.plateDiscipline.fpsPct >= 0.55
                            ? "good"
                            : "neutral"
                      }
                    />
                    <StatRow
                      label="Pitches per PA"
                      value={
                        data.plateDiscipline.pPa != null ? fmtDecimalNoLeadingZero(data.plateDiscipline.pPa, 2) : "—"
                      }
                      tone="neutral"
                    />
                  </div>
                </Panel>
              </div>
            </aside>
          </div>

          {/* Notes: full width under the grid */}
          <div
            id="post-notes"
            className="scroll-mt-6 mt-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/20 p-5 sm:mt-12 sm:p-7"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Staff</p>
            <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--text)]">Analyst notes</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
              Auto-generated takeaways plus your addendum (included when printing).
            </p>
            <ul className="mt-6 list-inside list-disc space-y-2.5 text-base leading-relaxed text-[var(--text)]">
              {data.analystNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <label className="mt-8 block">
              <span className="text-sm font-semibold text-[var(--text)]">Add bullets for coaches</span>
              <textarea
                value={analystAddendum}
                onChange={(e) => onAnalystAddendumChange(e.target.value)}
                rows={5}
                placeholder={"e.g.\n• Expanded at high heat with two strikes\n• Ran the bases aggressively on contact"}
                className="mt-2 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
