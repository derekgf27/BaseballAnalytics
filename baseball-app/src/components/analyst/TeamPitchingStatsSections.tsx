"use client";

import { useEffect, type ReactNode } from "react";
import {
  PitchingStatsSheet,
  type PitchingMatchupToolbarConfig,
  type PitchingSplitView,
  type PitchingStatsSheetProps,
} from "@/components/analyst/PitchingStatsSheet";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import { PITCH_TYPE_COLUMNS_MODE_LABEL, PITCH_TYPE_STATS_HELPER_TEXT } from "@/lib/pitchTypeBaaDisplay";
import { StatsRunnersFilterSelect } from "@/components/analyst/StatsRunnersFilterSelect";
import { StatsVenueFilterSelect } from "@/components/analyst/StatsVenueFilterSelect";
import type { BattingFinalCountBucketKey, StatsRunnersFilterKey } from "@/lib/types";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";

type TeamPitchingStatsSectionsProps = Omit<
  PitchingStatsSheetProps,
  | "heading"
  | "subheading"
  | "toolbarVariant"
  | "lockedSplitView"
  | "lockedRunnersFilter"
  | "lockedFinalCountBucket"
  | "lockedColumnMode"
  | "finalCountBucket"
  | "onFinalCountBucketChange"
  | "runnersFilter"
  | "onRunnersFilterChange"
  | "splitView"
  | "onSplitViewChange"
  | "venueFilter"
  | "onVenueFilterChange"
  | "toolbarEnd"
  | "sampleToolbarEnd"
  | "matchupToolbar"
  | "hideFilterFootnote"
> & {
  subheading?: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sampleToolbarEnd?: ReactNode;
  matchupToolbar?: PitchingMatchupToolbarConfig;
  splitView: PitchingSplitView;
  onSplitViewChange: (v: PitchingSplitView) => void;
  venueFilter: StatsVenueFilter;
  onVenueFilterChange: (v: StatsVenueFilter) => void;
  runnersFilter: StatsRunnersFilterKey;
  onRunnersFilterChange: (v: StatsRunnersFilterKey) => void;
  disciplineSplit: PitchingSplitView;
  onDisciplineSplitChange: (v: PitchingSplitView) => void;
  disciplineRunners: StatsRunnersFilterKey;
  onDisciplineRunnersChange: (v: StatsRunnersFilterKey) => void;
  disciplineCount: BattingFinalCountBucketKey | null;
  onDisciplineCountChange: (v: BattingFinalCountBucketKey | null) => void;
  finalCountSplit: PitchingSplitView;
  onFinalCountSplitChange: (v: PitchingSplitView) => void;
  finalCountRunners: StatsRunnersFilterKey;
  onFinalCountRunnersChange: (v: StatsRunnersFilterKey) => void;
  finalCountBucket: BattingFinalCountBucketKey;
  onFinalCountBucketChange: (v: BattingFinalCountBucketKey) => void;
  pitchTypesSplit: PitchingSplitView;
  onPitchTypesSplitChange: (v: PitchingSplitView) => void;
  pitchTypesRunners: StatsRunnersFilterKey;
  onPitchTypesRunnersChange: (v: StatsRunnersFilterKey) => void;
  pitchTypesCount: BattingFinalCountBucketKey | null;
  onPitchTypesCountChange: (v: BattingFinalCountBucketKey | null) => void;
};

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SectionSliceFilters({
  splitView,
  onSplitViewChange,
  runnersFilter,
  onRunnersFilterChange,
  splitDisabled = false,
}: {
  splitView: PitchingSplitView;
  onSplitViewChange: (v: PitchingSplitView) => void;
  runnersFilter: StatsRunnersFilterKey;
  onRunnersFilterChange: (v: StatsRunnersFilterKey) => void;
  splitDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Split</span>
        <select
          value={splitView}
          onChange={(e) => onSplitViewChange(e.target.value as PitchingSplitView)}
          disabled={splitDisabled}
          title={
            splitDisabled
              ? "Platoon split is off while a specific batter is selected."
              : undefined
          }
          className="w-full min-w-[10rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Pitching split view"
        >
          <option value="overall">Overall</option>
          <option value="vsLHB">vs LHB</option>
          <option value="vsRHB">vs RHB</option>
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Runners</span>
        <StatsRunnersFilterSelect
          value={runnersFilter}
          onChange={onRunnersFilterChange}
          className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
    </div>
  );
}

function CountTabBar({
  selected,
  onSelect,
  includeAll,
  ariaLabel,
}: {
  selected: BattingFinalCountBucketKey | null;
  onSelect: (v: BattingFinalCountBucketKey | null) => void;
  includeAll?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
    >
      {includeAll ? (
        <button
          type="button"
          role="tab"
          aria-selected={selected === null ? "true" : "false"}
          onClick={() => onSelect(null)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            selected === null
              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          All
        </button>
      ) : null}
      {FINAL_COUNT_BUCKET_OPTIONS.map((o) => {
        const isSelected = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={isSelected ? "true" : "false"}
            onClick={() => onSelect(o.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition ${
              isSelected
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Team pitching stats: one filterable main table, discipline + final-count sections with their own filters. */
export function TeamPitchingStatsSections({
  searchQuery,
  onSearchQueryChange,
  sampleToolbarEnd,
  matchupToolbar,
  subheading,
  splitView,
  onSplitViewChange,
  venueFilter,
  onVenueFilterChange,
  runnersFilter,
  onRunnersFilterChange,
  disciplineSplit,
  onDisciplineSplitChange,
  disciplineRunners,
  onDisciplineRunnersChange,
  disciplineCount,
  onDisciplineCountChange,
  finalCountSplit,
  onFinalCountSplitChange,
  finalCountRunners,
  onFinalCountRunnersChange,
  finalCountBucket,
  onFinalCountBucketChange,
  pitchTypesSplit,
  onPitchTypesSplitChange,
  pitchTypesRunners,
  onPitchTypesRunnersChange,
  pitchTypesCount,
  onPitchTypesCountChange,
  splitDisabled = false,
  ...sheetProps
}: TeamPitchingStatsSectionsProps) {
  useEffect(() => {
    if (!splitDisabled) return;
    if (splitView !== "overall") onSplitViewChange("overall");
    if (disciplineSplit !== "overall") onDisciplineSplitChange("overall");
    if (finalCountSplit !== "overall") onFinalCountSplitChange("overall");
    if (pitchTypesSplit !== "overall") onPitchTypesSplitChange("overall");
  }, [
    splitDisabled,
    splitView,
    disciplineSplit,
    finalCountSplit,
    pitchTypesSplit,
    onSplitViewChange,
    onDisciplineSplitChange,
    onFinalCountSplitChange,
    onPitchTypesSplitChange,
  ]);

  const sharedSheet: Omit<
    PitchingStatsSheetProps,
    "heading" | "lockedSplitView" | "lockedRunnersFilter" | "lockedVenueFilter" | "lockedFinalCountBucket" | "lockedColumnMode"
  > = {
    ...sheetProps,
    toolbarVariant: "section",
    searchQuery,
    onSearchQueryChange,
    splitDisabled,
  };

  const disciplineDescription =
    disciplineCount != null
      ? "Sw%, Whiff%, Foul%, and BIP% use pitches thrown at the selected count; Batters faced uses PAs that reached that count."
      : "Season swing, whiff, foul, and batted-ball rates (all PAs in the current sample).";

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Split
            </span>
            <select
              value={splitView}
              onChange={(e) => onSplitViewChange(e.target.value as PitchingSplitView)}
              disabled={splitDisabled}
              title={
                splitDisabled
                  ? "Platoon split is off while a specific batter is selected."
                  : undefined
              }
              className="w-full min-w-[10rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Pitching split view"
            >
              <option value="overall">Overall</option>
              <option value="vsLHB">vs LHB</option>
              <option value="vsRHB">vs RHB</option>
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Venue
            </span>
            <StatsVenueFilterSelect
              value={venueFilter}
              onChange={onVenueFilterChange}
              className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Runners
            </span>
            <StatsRunnersFilterSelect
              value={runnersFilter}
              onChange={onRunnersFilterChange}
              className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          {matchupToolbar ? (
            <>
              {matchupToolbar.battersFlat === undefined ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Opponent
                  </span>
                  <select
                    value={matchupToolbar.opponentKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      matchupToolbar.onOpponentChange(v);
                      matchupToolbar.onBatterChange("");
                    }}
                    className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label="Filter by opponent"
                  >
                    <option value="">All opponents (full season)</option>
                    {matchupToolbar.opponents.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Batter
                </span>
                <select
                  value={matchupToolbar.batterId}
                  onChange={(e) => matchupToolbar.onBatterChange(e.target.value)}
                  disabled={matchupToolbar.battersFlat === undefined ? !matchupToolbar.opponentKey : false}
                  className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Filter by opposing batter"
                >
                  <option value="">
                    {matchupToolbar.battersFlat !== undefined
                      ? "All batters"
                      : matchupToolbar.opponentKey
                        ? "All batters"
                        : "Choose opponent first"}
                  </option>
                  {(matchupToolbar.battersFlat ??
                    matchupToolbar.battersByOpponent[matchupToolbar.opponentKey] ??
                    []
                  ).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Search
            </span>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Player name…"
                className="w-full min-w-[12rem] max-w-[16rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
              />
              {sampleToolbarEnd ? <div className="shrink-0">{sampleToolbarEnd}</div> : null}
            </div>
          </div>
        </div>
        {subheading ? (
          <p className="rounded-md border border-[var(--accent)]/25 bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-base))] px-3 py-2 text-sm text-[var(--text-muted)]">
            {subheading}
          </p>
        ) : null}
      </div>

      <SectionBlock title="Pitching stats">
        <PitchingStatsSheet
          {...sharedSheet}
          splitView={splitView}
          onSplitViewChange={onSplitViewChange}
          venueFilter={venueFilter}
          onVenueFilterChange={onVenueFilterChange}
          runnersFilter={runnersFilter}
          onRunnersFilterChange={onRunnersFilterChange}
          lockedColumnMode="standard"
        />
      </SectionBlock>

      <SectionBlock title="Discipline & contact" description={disciplineDescription}>
        <div className="space-y-3">
          <SectionSliceFilters
            splitView={disciplineSplit}
            onSplitViewChange={onDisciplineSplitChange}
            runnersFilter={disciplineRunners}
            onRunnersFilterChange={onDisciplineRunnersChange}
            splitDisabled={splitDisabled}
          />
          <CountTabBar
            ariaLabel="Discipline count state"
            includeAll
            selected={disciplineCount}
            onSelect={onDisciplineCountChange}
          />
          <PitchingStatsSheet
            {...sharedSheet}
            lockedSplitView={disciplineSplit}
            lockedRunnersFilter={disciplineRunners}
            lockedVenueFilter={venueFilter}
            lockedFinalCountBucket={disciplineCount}
            lockedColumnMode="contact"
            hideFilterFootnote={disciplineCount == null}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="By final count"
        description="Compare arms on plate appearances that ended at the selected count (saved ball–strike count on the PA)."
      >
        <div className="space-y-3">
          <SectionSliceFilters
            splitView={finalCountSplit}
            onSplitViewChange={onFinalCountSplitChange}
            runnersFilter={finalCountRunners}
            onRunnersFilterChange={onFinalCountRunnersChange}
            splitDisabled={splitDisabled}
          />
          <CountTabBar
            ariaLabel="Final count bucket"
            selected={finalCountBucket}
            onSelect={(v) => v != null && onFinalCountBucketChange(v)}
          />
          <PitchingStatsSheet
            {...sharedSheet}
            lockedSplitView={finalCountSplit}
            lockedRunnersFilter={finalCountRunners}
            lockedVenueFilter={venueFilter}
            lockedFinalCountBucket={finalCountBucket}
            lockedColumnMode="finalCount"
            hideFilterFootnote={
              finalCountRunners === "all" && finalCountSplit === "overall"
            }
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title={PITCH_TYPE_COLUMNS_MODE_LABEL}
        description={
          pitchTypesCount != null
            ? `${PITCH_TYPE_STATS_HELPER_TEXT} Mix, Sw%, Whiff%, Strike%, and BAA use pitches thrown at the selected count state; K% needs the full sample (clear count to view).`
            : PITCH_TYPE_STATS_HELPER_TEXT
        }
      >
        <div className="space-y-3">
          <SectionSliceFilters
            splitView={pitchTypesSplit}
            onSplitViewChange={onPitchTypesSplitChange}
            runnersFilter={pitchTypesRunners}
            onRunnersFilterChange={onPitchTypesRunnersChange}
            splitDisabled={splitDisabled}
          />
          <CountTabBar
            ariaLabel="Pitch-type count state"
            includeAll
            selected={pitchTypesCount}
            onSelect={onPitchTypesCountChange}
          />
          <PitchingStatsSheet
            {...sharedSheet}
            lockedSplitView={pitchTypesSplit}
            lockedRunnersFilter={pitchTypesRunners}
            lockedVenueFilter={venueFilter}
            lockedFinalCountBucket={pitchTypesCount}
            lockedColumnMode="pitchTypes"
            hideFilterFootnote={pitchTypesCount == null}
          />
        </div>
      </SectionBlock>
    </div>
  );
}
