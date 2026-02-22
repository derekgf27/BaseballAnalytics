"use client";

import { useState } from "react";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { SituationResult } from "@/components/coach/SituationResult";
import { situationPrompt } from "@/lib/compute";
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Situation</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Inning, outs, bases, batter → one recommendation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-xs text-[var(--text-muted)]">Inning</span>
          <select value={inning} onChange={(e) => setInning(Number(e.target.value))} className="input-tech mt-1 block w-full px-3 py-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Outs</span>
          <div className="mt-1 flex gap-2">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOuts(n)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                  outs === n ? "border-[var(--accent-coach)] bg-[var(--accent-coach)] text-[var(--bg-base)]" : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div>
        <span className="text-xs text-[var(--text-muted)]">Runners on</span>
        <div className="mt-1">
          <BaseStateSelector value={baseState} onChange={setBaseState} />
        </div>
      </div>

      <label>
        <span className="text-xs text-[var(--text-muted)]">Score diff (we're ahead by)</span>
        <input type="number" value={scoreDiff} onChange={(e) => setScoreDiff(Number(e.target.value))} className="input-tech mt-1 w-24 px-3 py-2" />
      </label>

      <label>
        <span className="text-xs text-[var(--text-muted)]">Batter</span>
        <select
          value={batterId ?? ""}
          onChange={(e) => setBatterId(e.target.value || null)}
          className="input-tech mt-1 block w-full max-w-xs px-3 py-2"
        >
          <option value="">Select</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={runSituation}
        className="w-full rounded-lg bg-[var(--accent-coach)] py-3 font-medium text-[var(--bg-base)]"
      >
        Get recommendation
      </button>

      {result && (
        <SituationResult tone={result.tone} sentence={result.sentence} />
      )}
    </div>
  );
}
