"use client";

import type { PostGameSnapshot } from "@/lib/reports/postGameSnapshot";
import { matchupLabelUsFirst, ourTeamName } from "@/lib/opponentUtils";
import type { Game } from "@/lib/types";

const jumpLink =
  "rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]";

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/45 bg-emerald-950/35 text-emerald-100"
      : tone === "bad"
        ? "border-rose-500/45 bg-rose-950/35 text-rose-100"
        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
    </div>
  );
}

function ReportSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
      <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div>
        <p className="text-base font-medium text-[var(--text)]">{label}</p>
        {hint ? <p className="mt-0.5 text-sm text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      <p className="font-display shrink-0 text-xl font-bold tabular-nums text-[var(--accent)] sm:text-right">{value}</p>
    </div>
  );
}

export function PostGameReport({
  game,
  data,
  analystAddendum,
  onAnalystAddendumChange,
}: {
  game: Game;
  data: PostGameSnapshot;
  analystAddendum: string;
  onAnalystAddendumChange: (v: string) => void;
}) {
  const off = data.teamOffense;
  const fmtPct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="space-y-8">
      <nav
        className="print:hidden flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3"
        aria-label="Jump to section"
      >
        <span className="w-full text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:w-auto sm:py-1.5">
          Jump to
        </span>
        <a href="#post-score" className={jumpLink}>
          Score
        </a>
        <a href="#post-runs" className={jumpLink}>
          Runs
        </a>
        <a href="#post-offense" className={jumpLink}>
          Offense
        </a>
        <a href="#post-discipline" className={jumpLink}>
          Discipline
        </a>
        <a href="#post-sit" className={jumpLink}>
          Situations
        </a>
        <a href="#post-spotlight" className={jumpLink}>
          Standouts
        </a>
        <a href="#post-notes" className={jumpLink}>
          Notes
        </a>
      </nav>

      <div id="post-score" className="scroll-mt-6 rounded-xl border-2 border-[var(--accent)]/35 bg-[var(--accent-dim)]/25 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent)]">Post-game snapshot</p>
        <p className="mt-2 font-display text-2xl font-bold leading-tight text-[var(--text)] sm:text-3xl">
          {matchupLabelUsFirst(game, true)}
        </p>
        {data.finalScore ? (
          <p className="mt-4 font-display text-4xl font-bold tabular-nums text-[var(--text)] sm:text-5xl">
            {data.finalScore.ours}
            <span className="mx-2 text-[var(--text-muted)]">–</span>
            {data.finalScore.opp}
            <span className="ml-3 block text-base font-normal text-[var(--text-muted)] sm:inline sm:ml-4">
              {ourTeamName(game)} runs: {data.finalScore.ours}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-base text-[var(--text-muted)]">
            Final score not entered—numbers below are from logged PAs only.
          </p>
        )}
        {data.keyMoment ? (
          <p className="mt-5 border-t border-[var(--accent)]/25 pt-4 text-lg leading-relaxed text-[var(--text)]">
            {data.keyMoment}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection id="post-runs" title={`Runs by inning (${ourTeamName(game)})`}>
          <div className="flex flex-wrap gap-3">
            {data.runsByInning.map((row) => (
              <div
                key={row.inning}
                className="flex min-w-[3.5rem] flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3"
              >
                <span className="text-xs font-bold text-[var(--text-muted)]">{row.inning}</span>
                <span className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">{row.runs}</span>
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection id="post-offense" title={`Team offense (${ourTeamName(game)})`}>
          {off ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatChip label="AVG" value={off.avg.toFixed(3)} />
                <StatChip label="OBP" value={off.obp.toFixed(3)} />
                <StatChip label="SLG" value={off.slg.toFixed(3)} />
                <StatChip
                  label="OPS"
                  value={off.ops.toFixed(3)}
                  tone={off.ops >= 0.75 ? "good" : off.ops < 0.6 ? "bad" : "neutral"}
                />
                <StatChip label="K%" value={fmtPct(off.kPct)} tone={off.kPct > 0.28 ? "bad" : "neutral"} />
                <StatChip label="BB%" value={fmtPct(off.bbPct)} tone={off.bbPct > 0.1 ? "good" : "neutral"} />
              </div>
              <p className="mt-5 text-base leading-relaxed text-[var(--text)]">
                <span className="font-semibold">RISP: </span>
                {off.rispLine}
              </p>
            </>
          ) : (
            <p className="text-base leading-relaxed text-[var(--text-muted)]">
              No plate appearances logged for {ourTeamName(game)} in this game. Enter PAs on{" "}
              <strong className="text-[var(--text)]">Record</strong> to populate this section.
            </p>
          )}
        </ReportSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection id="post-discipline" title="Plate discipline">
          <div className="divide-y divide-[var(--border)]">
            <MetricRow
              label="First-pitch strike %"
              hint="Share of PAs where first pitch was a strike (when tracked)"
              value={data.plateDiscipline.fpsPct != null ? fmtPct(data.plateDiscipline.fpsPct) : "—"}
            />
            <MetricRow
              label="Pitches per PA"
              hint="Average pitches seen per completed PA"
              value={data.plateDiscipline.pPa != null ? data.plateDiscipline.pPa.toFixed(2) : "—"}
            />
          </div>
        </ReportSection>

        <ReportSection id="post-sit" title="Situational">
          <div className="divide-y divide-[var(--border)]">
            <MetricRow
              label="RISP"
              hint="Hits and opportunities with runners on 2nd and/or 3rd"
              value={
                <>
                  {data.situational.rispHits} for {data.situational.rispPa}
                </>
              }
            />
            <MetricRow
              label="Productive outs"
              hint="Sacrifice flies and sacrifice bunts"
              value={data.situational.productiveOuts}
            />
            <MetricRow label="Ground into double play" value={data.situational.gidp} />
          </div>
        </ReportSection>
      </div>

      <div id="post-spotlight" className="scroll-mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border-2 border-[var(--accent)]/35 bg-[var(--accent-dim)]/20 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">Best hitter</h3>
          {data.gameChangers.bestHitter ? (
            <>
              <p className="mt-3 font-display text-xl font-bold text-[var(--text)]">{data.gameChangers.bestHitter.name}</p>
              <p className="mt-2 text-base text-[var(--text-muted)]">{data.gameChangers.bestHitter.line}</p>
              <p className="mt-2 font-display text-lg font-bold tabular-nums text-[var(--accent)]">
                OPS {data.gameChangers.bestHitter.ops.toFixed(3)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-[var(--text-muted)]">
              Need at least two PAs in a row to highlight a top performer.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-300">Tough night</h3>
          <p className="mt-3 text-base leading-relaxed text-[var(--text)]">{data.gameChangers.worstAbsNote}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Clutch (RISP)</h3>
          {data.gameChangers.clutch ? (
            <>
              <p className="mt-3 font-display text-xl font-bold text-[var(--text)]">{data.gameChangers.clutch.name}</p>
              <p className="mt-2 text-base text-[var(--text-muted)]">
                {data.gameChangers.clutch.avgRisp} AVG · {data.gameChangers.clutch.pa} PA
              </p>
            </>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-[var(--text-muted)]">
              Not enough RISP PAs to name a stand-alone clutch line.
            </p>
          )}
        </div>
      </div>

      <ReportSection id="post-notes" title="Analyst notes">
        <ul className="list-inside list-disc space-y-2.5 text-base leading-relaxed text-[var(--text)]">
          {data.analystNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <label className="mt-6 block">
          <span className="text-sm font-semibold text-[var(--text)]">Add bullets for coaches (prints with the report)</span>
          <textarea
            value={analystAddendum}
            onChange={(e) => onAnalystAddendumChange(e.target.value)}
            rows={5}
            placeholder={"e.g.\n• Expanded at high heat with two strikes\n• Ran the bases aggressively on contact"}
            className="mt-2 w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </label>
      </ReportSection>
    </div>
  );
}
