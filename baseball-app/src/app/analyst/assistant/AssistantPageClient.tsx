"use client";

import Link from "next/link";
import { AnalystAssistantPanel } from "@/components/analyst/AnalystAssistantPanel";

export function AssistantPageClient({
  teamTrendInsights,
  canEdit,
}: {
  teamTrendInsights: string[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="font-orbitron text-3xl font-semibold tracking-tight text-[var(--text)]">Assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Ask about app workflows (recording, lineups, stats, reports) or broader questions—mention a date or opponent if
          you want something game-specific. Team trend notes load when available.{" "}
          <Link href="/reports" className="font-medium text-[var(--accent)] hover:underline">
            Reports hub →
          </Link>
        </p>
      </header>

      {!canEdit && (
        <div
          className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]"
          style={{ background: "var(--warning-dim)" }}
        >
          Connect Supabase for live data and full assistant context.
        </div>
      )}

      <AnalystAssistantPanel
        teamTrendInsights={teamTrendInsights}
        title="Analyst Assistant"
        badgeLabel="Context-grounded"
        chatMaxHeightClass="max-h-[min(36rem,60vh)]"
      />
    </div>
  );
}
