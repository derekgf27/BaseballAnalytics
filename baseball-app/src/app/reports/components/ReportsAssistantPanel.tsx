"use client";

import { useMemo, useState } from "react";
import type { PreGameOverviewPayload } from "@/app/reports/actions";
import type { Game } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Give me a pre-game summary for this game",
  "What are our OPS, K%, and BB% trends?",
  "What's the pitching plan and top pitch mix?",
  "Give me matchup insights and game plan",
];

export function ReportsAssistantPanel({
  selectedGame,
  preGameOverview,
  teamTrendInsights,
}: {
  selectedGame: Game | null;
  preGameOverview: PreGameOverviewPayload | null;
  teamTrendInsights: string[];
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Ask for pre-game summary, OPS/K%/BB%/RISP trends, pitching plan, matchup insights, or game plan. I answer from your loaded report context.",
    },
  ]);

  const context = useMemo(
    () => ({
      game: selectedGame
        ? {
            id: selectedGame.id,
            date: selectedGame.date,
            home_team: selectedGame.home_team,
            away_team: selectedGame.away_team,
            our_side: selectedGame.our_side,
          }
        : null,
      preGameOverview: preGameOverview
        ? {
            report: preGameOverview.report,
            recentGamesCount: preGameOverview.recentGamesCount,
          }
        : null,
      teamTrendInsights,
    }),
    [preGameOverview, selectedGame, teamTrendInsights]
  );

  async function send(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuery("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, context }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Could not get an answer right now." },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer ?? "No answer returned." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error while asking assistant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-orbitron text-base font-semibold text-[var(--text)]">Reports Assistant (v1)</h2>
        <span className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text)]">
          Context-grounded
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}`} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text)]">
              {m.role === "assistant" ? "Assistant" : "You"}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{m.content}</p>
          </div>
        ))}
        {loading ? <p className="text-sm text-[var(--text)]">Thinking…</p> : null}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a stats/report question…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="font-orbitron inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
