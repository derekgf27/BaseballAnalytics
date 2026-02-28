"use client";

import { useState } from "react";
import {
  getExpectedRunsRemaining,
  getRunValueOfEvent,
  getRunImpact,
} from "@/lib/compute/runExpectancy";
import type { RETable } from "@/lib/compute/runExpectancy";
import type { BaseState, PAResult } from "@/lib/types";

const RESULT_LABELS: Record<PAResult, string> = {
  single: "1B",
  double: "2B",
  triple: "3B",
  hr: "HR",
  out: "Out",
  so: "SO",
  so_looking: "ꓘ",
  bb: "BB",
  ibb: "IBB",
  hbp: "HBP",
  sac_fly: "SF",
  sac_bunt: "SH",
  sac: "SAC",
  other: "Other",
};

const BASE_STATE_LABELS: Record<string, string> = {
  "000": "Bases empty",
  "100": "1st",
  "010": "2nd",
  "001": "3rd",
  "110": "1st & 2nd",
  "101": "1st & 3rd",
  "011": "2nd & 3rd",
  "111": "Loaded",
};

interface RunExpectancyClientProps {
  reTable: RETable;
  counts: Record<string, number>;
  baseStates: BaseState[];
  outsList: number[];
  totalPA: number;
}

export function RunExpectancyClient({
  reTable,
  counts,
  baseStates,
  outsList,
  totalPA,
}: RunExpectancyClientProps) {
  const [baseState, setBaseState] = useState<BaseState>("000");
  const [outs, setOuts] = useState(0);
  const [result, setResult] = useState<PAResult>("single");
  const [runsOnPlay, setRunsOnPlay] = useState(0);

  const [impactBase, setImpactBase] = useState<BaseState>("100");
  const [impactOuts, setImpactOuts] = useState(0);
  const [eventAResult, setEventAResult] = useState<PAResult>("sac_bunt");
  const [eventARuns, setEventARuns] = useState(0);
  const [eventBResult, setEventBResult] = useState<PAResult>("out");
  const [eventBRuns, setEventBRuns] = useState(0);

  const key = (b: BaseState, o: number) => `${b}_${o}`;
  const runValue = getRunValueOfEvent(reTable, baseState, outs, result, runsOnPlay);
  const runImpact = getRunImpact(
    reTable,
    impactBase,
    impactOuts,
    { result: eventAResult, runsOnPlay: eventARuns },
    { result: eventBResult, runsOnPlay: eventBRuns }
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Run expectancy
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Expected runs from each base/out state, built from your team&apos;s plate appearances.
          Updates automatically when new game data is added. Use for in-game decisions and
          post-game analysis.
        </p>
        {totalPA > 0 && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Built from {totalPA} plate appearance{totalPA !== 1 ? "s" : ""}.
          </p>
        )}
      </div>

      {/* RE Table */}
      <div className="card-tech rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Expected runs remaining in inning
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Read: &quot;From this state, we expect X runs to score by end of inning.&quot;
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">
                  Base state
                </th>
                {outsList.map((o) => (
                  <th key={o} className="px-3 py-2 text-right font-medium text-[var(--text-muted)]">
                    {o} out{o !== 1 ? "s" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baseStates.map((b) => (
                <tr key={b} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2 text-[var(--text)]">
                    {BASE_STATE_LABELS[b] ?? b}
                  </td>
                  {outsList.map((o) => {
                    const val = getExpectedRunsRemaining(reTable, b, o);
                    const count = counts[key(b, o)] ?? 0;
                    return (
                      <td
                        key={o}
                        className="px-3 py-2 text-right tabular-nums text-[var(--text)]"
                      >
                        {totalPA === 0 ? (
                          "—"
                        ) : (
                          <>
                            <span className="font-medium">
                              {Number.isNaN(val) ? "—" : val.toFixed(2)}
                            </span>
                            {count > 0 && (
                              <span className="ml-1 text-xs text-[var(--text-muted)]">
                                (n={count})
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run value of an event */}
      <div className="card-tech rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Run value of an event
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          How many runs this play adds or costs vs. the current state expectation.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Base state</span>
            <select
              value={baseState}
              onChange={(e) => setBaseState(e.target.value as BaseState)}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
            >
              {baseStates.map((b) => (
                <option key={b} value={b}>
                  {BASE_STATE_LABELS[b] ?? b}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Outs</span>
            <select
              value={outs}
              onChange={(e) => setOuts(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
            >
              {outsList.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Event</span>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value as PAResult)}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
            >
              {(Object.keys(RESULT_LABELS) as PAResult[]).map((r) => (
                <option key={r} value={r}>
                  {RESULT_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Runs on play</span>
            <input
              type="number"
              min={0}
              max={4}
              value={runsOnPlay}
              onChange={(e) => setRunsOnPlay(Number(e.target.value) || 0)}
              className="w-20 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
            />
          </label>
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--text)]">
          Run value:{" "}
          <span className={runValue >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
            {totalPA === 0 ? "—" : runValue.toFixed(2)} runs
          </span>
        </p>
      </div>

      {/* Run impact of a decision */}
      <div className="card-tech rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Run impact of a decision
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Compare two choices (e.g. bunt vs swing). Positive = Option A is better.
        </p>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Base state</span>
              <select
                value={impactBase}
                onChange={(e) => setImpactBase(e.target.value as BaseState)}
                className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
              >
                {baseStates.map((b) => (
                  <option key={b} value={b}>
                    {BASE_STATE_LABELS[b] ?? b}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Outs</span>
              <select
                value={impactOuts}
                onChange={(e) => setImpactOuts(Number(e.target.value))}
                className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text)]"
              >
                {outsList.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-[var(--border)] p-3">
              <span className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                Option A
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={eventAResult}
                  onChange={(e) => setEventAResult(e.target.value as PAResult)}
                  className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text)]"
                  aria-label="Option A event"
                >
                  {(Object.keys(RESULT_LABELS) as PAResult[]).map((r) => (
                    <option key={r} value={r}>
                      {RESULT_LABELS[r]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={eventARuns}
                  onChange={(e) => setEventARuns(Number(e.target.value) || 0)}
                  placeholder="Runs"
                  className="w-16 rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text)]"
                />
              </div>
            </div>
            <div className="rounded border border-[var(--border)] p-3">
              <span className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                Option B
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={eventBResult}
                  onChange={(e) => setEventBResult(e.target.value as PAResult)}
                  className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text)]"
                  aria-label="Option B event"
                >
                  {(Object.keys(RESULT_LABELS) as PAResult[]).map((r) => (
                    <option key={r} value={r}>
                      {RESULT_LABELS[r]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={eventBRuns}
                  onChange={(e) => setEventBRuns(Number(e.target.value) || 0)}
                  placeholder="Runs"
                  className="w-16 rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text)]"
                />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--text)]">
          Run impact (A − B):{" "}
          <span
            className={
              runImpact > 0
                ? "text-[var(--success)]"
                : runImpact < 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--text-muted)]"
            }
          >
            {totalPA === 0 ? "—" : `${runImpact >= 0 ? "+" : ""}${runImpact.toFixed(2)} runs`}
          </span>
          {totalPA > 0 && (
            <span className="ml-2 text-[var(--text-muted)]">
              {runImpact > 0 ? "→ Prefer A" : runImpact < 0 ? "→ Prefer B" : "→ Tie"}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
