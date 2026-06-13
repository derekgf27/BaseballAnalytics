"use client";

import Link from "next/link";
import { useState } from "react";
import { normalizeInsightsDashboard } from "@/lib/insights/dashboard";
import type { InsightsDashboard } from "@/lib/insights";
import {
  ActionCenterPanel,
  AlertsFeedPanel,
  DashboardMetaBar,
  DrillDownPanel,
  ExecutiveSummaryPanel,
  HotColdPlayersPanel,
  PitchCenterPanel,
  Section,
  TeamStoryPanel,
  TeamTrendsPanel,
} from "./InsightsDashboardUi";

export function InsightsPageClient({ dashboard: rawDashboard }: { dashboard: InsightsDashboard }) {
  const dashboard = normalizeInsightsDashboard(rawDashboard);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => new Set());

  const hasContent =
    dashboard.kpis.length > 0 ||
    dashboard.pitchCenter.arsenal.length > 0 ||
    dashboard.teamStory.length > 0 ||
    dashboard.alertsFeed.length > 0 ||
    dashboard.playerTrends.hottestHitters.length > 0;

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id));
  };

  return (
    <div className="pb-14">
      <header className="space-y-3 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Analytics command center
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Insights</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
              Scan team health in 15 seconds, act on coaching priorities, then drill into detail when you
              need it.
            </p>
          </div>
          <Link
            href="/analyst/reports"
            className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border-focus)] hover:text-[var(--accent)]"
          >
            Export via reports →
          </Link>
        </div>
        <DashboardMetaBar meta={dashboard.meta} />
      </header>

      {!hasContent ? (
        <Section title="No dashboard data yet" subtitle="Finalize games with plate appearances to activate.">
          <div className="card-tech rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Once you have a few completed games, this page will surface team health, actions, trends, and
              pitch intelligence automatically.
            </p>
            <Link
              href="/analyst/games"
              className="mt-5 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] hover:brightness-110"
            >
              Go to games
            </Link>
          </div>
        </Section>
      ) : (
        <div className="mt-8 lg:grid lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-8 xl:grid-cols-[1fr_19rem]">
          <div className="min-w-0 space-y-10">
            <Section title="Executive summary" subtitle="Are we playing well? What matters most right now?">
              <ExecutiveSummaryPanel summary={dashboard.executive} />
            </Section>

            <Section title="Action center" subtitle="What should coaches do next?">
              <ActionCenterPanel actionCenter={dashboard.actionCenter} />
            </Section>

            <Section title="Team trends" subtitle="Last 3 games vs prior sample">
              <TeamTrendsPanel kpis={dashboard.kpis} />
            </Section>

            <Section title="Hot & cold players" subtitle="Who is driving results?">
              <HotColdPlayersPanel trends={dashboard.playerTrends} />
            </Section>

            <Section title="Pitch intelligence" subtitle="Which pitch types are working?">
              <PitchCenterPanel center={dashboard.pitchCenter} />
            </Section>

            <Section title="Team story" subtitle="Analytics summary in plain language">
              <TeamStoryPanel items={dashboard.teamStory} />
            </Section>

            <Section title="Detailed analytics" subtitle="Pitch mix and full player trend lines">
              <DrillDownPanel drillDown={dashboard.drillDown} />
            </Section>
          </div>

          <aside className="mt-10 lg:sticky lg:top-6 lg:mt-0 lg:self-start">
            <AlertsFeedPanel
              alerts={dashboard.alertsFeed}
              dismissed={dismissedAlerts}
              onDismiss={dismissAlert}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
