"use client";

import { useState } from "react";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { SituationResult } from "@/components/coach/SituationResult";
import { situationPrompt } from "@/lib/compute";
import { INNING_SELECT_VALUES } from "@/lib/leagueConfig";
import type { Player, Ratings } from "@/lib/types";

// Default ratings when no PA data (coach still gets a recommendation)
const DEFAULT_RATINGS: Ratings = {
  contact_reliability: 3,
  damage_potential: 3,
  decision_quality: 3,
  defense_trust: 3,
};

interface SituationPageClientProps {
  players: Player[];
  // In real app we'd pass precomputed ratings per player from server
}

export function SituationPageClient({ players }: SituationPageClientProps) {
  const [inning, setInning] = useState(5);
  const [outs, setOuts] = useState(1);
  const [baseState, setBaseState] = useState("100");
  const [scoreDiff, setScoreDiff] = useState(0);
  const [batterId, setBatterId] = useState<string | null>(players[0]?.id ?? null);
  const [result, setResult] = useState<{ tone: "aggressive" | "neutral" | "conservative"; sentence: string } | null>(null);

  const runSituation = () => {
    const res = situationPrompt(
      { inning, outs, base_state: baseState, score_diff: scoreDiff },
      DEFAULT_RATINGS
    );
    setResult(res);
  };

  return (
    <div className="app-shell min-h-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
        {/* Header */}
        <header>
          <div className="section-label">Coach tools</div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
            Situation recommendation
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pick inning, outs, bases, and batter to get a quick aggressive / neutral / conservative suggestion.
          </p>
        </header>

        {/* Main layout: controls on the left, recommendation on the right */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* Controls */}
          <section className="neo-card p-4 lg:p-5">
            <div className="section-label mb-3">Game state</div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[var(--neo-text-muted)]">Inning</span>
                <select
                  value={inning}
                  onChange={(e) => setInning(Number(e.target.value))}
                  className="input-tech mt-1 block w-full px-3 py-2"
                >
                  {INNING_SELECT_VALUES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-xs text-[var(--neo-text-muted)]">Outs</span>
                <div className="mt-1 flex gap-2">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOuts(n)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                        outs === n
                          ? "border-[var(--accent-coach)] bg-[var(--accent-coach)] text-[var(--bg-base)]"
                          : "border-[var(--neo-border)] bg-[var(--bg-input)] text-[var(--neo-text-muted)] hover:border-[var(--accent-coach)]/60 hover:text-[var(--neo-text)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs text-[var(--neo-text-muted)]">Runners on</span>
              <div className="mt-1">
                <BaseStateSelector value={baseState} onChange={setBaseState} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[var(--neo-text-muted)]">Score diff (we&apos;re ahead by)</span>
                <input
                  type="number"
                  value={scoreDiff}
                  onChange={(e) => setScoreDiff(Number(e.target.value))}
                  className="input-tech mt-1 w-full px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="text-xs text-[var(--neo-text-muted)]">Batter</span>
                <select
                  value={batterId ?? ""}
                  onChange={(e) => setBatterId(e.target.value || null)}
                  className="input-tech mt-1 block w-full px-3 py-2"
                >
                  <option value="">Select batter</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={runSituation}
              className="mt-6 w-full rounded-lg bg-[var(--accent-coach)] py-3 text-sm font-semibold text-[var(--bg-base)] shadow-[0_0_18px_rgba(214,186,72,0.45)] hover:opacity-90 transition"
            >
              Get recommendation
            </button>
          </section>

          {/* Recommendation panel */}
          <section className="neo-card flex flex-col justify-between p-4 lg:p-5">
            <div>
              <div className="section-label mb-2">Recommendation</div>
              {!result && (
                <p className="text-sm text-[var(--neo-text-muted)]">
                  Set the game state on the left and click <span className="font-semibold">Get recommendation</span> to see the suggested tone for this at-bat.
                </p>
              )}
              {result && (
                <div className="mt-2">
                  <SituationResult tone={result.tone} sentence={result.sentence} />
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] text-[var(--neo-text-muted)]">
              This is a simple rules-based guide that looks at inning, score, outs, and base state. We can later plug in batter-specific stats to refine the tone.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
