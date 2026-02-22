"use client";

import { useState } from "react";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import type { PAResult, BaseState } from "@/lib/types";

const RESULT_OPTIONS: { value: PAResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "hr", label: "HR" },
  { value: "out", label: "Out" },
  { value: "so", label: "SO" },
  { value: "bb", label: "BB" },
  { value: "ibb", label: "IBB" },
  { value: "hbp", label: "HBP" },
  { value: "sac_fly", label: "SF" },
  { value: "sac_bunt", label: "SH" },
  { value: "other", label: "Other" },
];

interface LogPAFormProps {
  gameId: string;
  batterId: string;
  batterName: string;
  onSuccess: () => void;
  onSubmit: (pa: Omit<import("@/lib/types").PlateAppearance, "id" | "created_at">) => Promise<unknown>;
}

export function LogPAForm({
  gameId,
  batterId,
  batterName,
  onSuccess,
  onSubmit,
}: LogPAFormProps) {
  const [inning, setInning] = useState(1);
  const [outs, setOuts] = useState(0);
  const [baseState, setBaseState] = useState<BaseState>("000");
  const [scoreDiff, setScoreDiff] = useState(0);
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [result, setResult] = useState<PAResult | null>(null);
  const [contactQuality, setContactQuality] = useState<"soft" | "medium" | "hard" | null>(null);
  const [chase, setChase] = useState<boolean | null>(null);
  const [pitchesSeen, setPitchesSeen] = useState<number | "">("");
  const [rbi, setRbi] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (result === null) return;
    setSaving(true);
    try {
      await onSubmit({
        game_id: gameId,
        batter_id: batterId,
        inning,
        outs,
        base_state: baseState,
        score_diff: scoreDiff,
        count_balls: balls,
        count_strikes: strikes,
        result,
        contact_quality: contactQuality,
        chase,
        hit_direction: null,
        pitches_seen: pitchesSeen === "" ? null : pitchesSeen,
        rbi,
        notes: notes || null,
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-tech space-y-6 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Log PA — {batterName}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-[var(--text-muted)]">Inning</span>
          <select
            value={inning}
            onChange={(e) => setInning(Number(e.target.value))}
            className="input-tech mt-1 block w-full px-3 py-2"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-[var(--text-muted)]">Outs</span>
          <div className="mt-1 flex gap-2">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOuts(n)}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium ${
                  outs === n ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]" : "border-[var(--border)] bg-[var(--bg-input)]"
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

      <div>
        <span className="text-xs text-[var(--text-muted)]">Score diff (we're ahead by)</span>
        <input
          type="number"
          value={scoreDiff}
          onChange={(e) => setScoreDiff(Number(e.target.value))}
          className="input-tech mt-1 w-24 px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-xs text-[var(--text-muted)]">Count (B-S)</span>
        {[0, 1, 2, 3].map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBalls(b)}
            className="rounded-lg border px-2 py-1 text-sm"
          >
            {b}-{strikes}
          </button>
        ))}
        {[0, 1, 2].map((s) => (
          <button
            key={`s-${s}`}
            type="button"
            onClick={() => setStrikes(s)}
            className="rounded-lg border px-2 py-1 text-sm"
          >
            {balls}-{s}
          </button>
        ))}
      </div>

      <div>
        <span className="block text-xs text-[var(--text-muted)]">Result (tap one)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setResult(opt.value)}
              className={`min-w-[3.5rem] rounded-xl border-2 px-4 py-3 text-sm font-medium ${
                result === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                  : "border-[var(--border)] bg-[var(--bg-input)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-[var(--text-muted)]">Contact (optional)</span>
        <div className="mt-1 flex gap-2">
          {(["soft", "medium", "hard"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setContactQuality(contactQuality === q ? null : q)}
              className={`rounded-lg border px-3 py-1 text-sm ${
                contactQuality === q ? "border-[var(--accent)] bg-[var(--accent-dim)]" : ""
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-[var(--text-muted)]">Chase?</span>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setChase(true)}
            className={`rounded-lg border px-3 py-1 text-sm ${chase === true ? "bg-amber-100" : ""}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setChase(false)}
            className={`rounded-lg border px-3 py-1 text-sm ${chase === false ? "bg-emerald-100" : ""}`}
          >
            No
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <label>
          <span className="text-xs text-[var(--text-muted)]">Pitches</span>
          <input
            type="number"
            min={0}
            value={pitchesSeen}
            onChange={(e) =>
              setPitchesSeen(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="ml-2 w-16 rounded border px-2 py-1"
          />
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">RBI</span>
          <input
            type="number"
            min={0}
            value={rbi}
            onChange={(e) => setRbi(Number(e.target.value))}
            className="ml-2 w-14 rounded border px-2 py-1"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-[var(--text-muted)]">Notes</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-tech mt-1 w-full px-3 py-2"
          placeholder="Optional"
        />
      </label>

      <button
        type="submit"
        disabled={result === null || saving}
        className="w-full rounded-lg bg-[var(--accent)] py-3 font-medium text-[var(--bg-base)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save PA"}
      </button>
    </form>
  );
}
