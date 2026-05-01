"use client";

import { useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const DEFAULT_SUGGESTIONS = [
  "How do I open pre-game scouting and team trends?",
  "What are our OPS, K%, and BB% trends?",
  "How do I record plate appearances in this app?",
  "How do I build or edit lineups for a game?",
  "Where are matchup notes and game plan in Reports?",
];

export type AnalystAssistantPanelProps = {
  teamTrendInsights: string[];
  /** Main heading */
  title?: string;
  /** Small badge next to title */
  badgeLabel?: string;
  /** First assistant bubble */
  introMessage?: string;
  /** Quick-prompt chips */
  suggestions?: string[];
  inputPlaceholder?: string;
  /** Tailwind max-height class for the transcript area */
  chatMaxHeightClass?: string;
};

export function AnalystAssistantPanel({
  teamTrendInsights,
  title = "Analyst Assistant",
  badgeLabel = "Context-grounded",
  introMessage = "Ask how to use the app or about team trends when they’re loaded. For scouting numbers tied to one game, use Reports or name the matchup in your message.",
  suggestions = DEFAULT_SUGGESTIONS,
  inputPlaceholder = "Ask a question…",
  chatMaxHeightClass = "max-h-[min(32rem,55vh)]",
}: AnalystAssistantPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: introMessage }]);

  const context = useMemo(
    () => ({
      game: null,
      preGameOverview: null,
      teamTrendInsights,
    }),
    [teamTrendInsights]
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
        <h2 className="font-orbitron text-base font-semibold text-[var(--text)]">{title}</h2>
        <span className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text)]">
          {badgeLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
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

      <div
        className={`mt-4 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3 ${chatMaxHeightClass}`}
      >
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
          placeholder={inputPlaceholder}
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
