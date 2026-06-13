"use client";

import { useEffect, type ReactNode } from "react";
import {
  BattingStatsSheet,
  type BattingMatchupToolbarConfig,
  type BattingStatsSheetProps,
  type SplitView,
} from "@/components/analyst/BattingStatsSheet";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import { StatsRunnersFilterSelect } from "@/components/analyst/StatsRunnersFilterSelect";
import { StatsVenueFilterSelect } from "@/components/analyst/StatsVenueFilterSelect";
import { BattingPitchTypeTeamSheet } from "@/components/analyst/BattingPitchTypeTeamSheet";
import { BattingPitchTypeDisciplineTeamSheet } from "@/components/analyst/BattingPitchTypeDisciplineTeamSheet";
import {
  BAT_PITCH_TYPE_COLUMNS_MODE_LABEL,
  BAT_PITCH_TYPE_DISCIPLINE_MODE_LABEL,
  BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT,
  BAT_PITCH_TYPE_STATS_HELPER_TEXT,
} from "@/lib/pitchTypeBattingDisplay";
import type { BattingFinalCountBucketKey, StatsRunnersFilterKey } from "@/lib/types";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";

type TeamBattingStatsSectionsProps = Omit<
  BattingStatsSheetProps,
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
  matchupToolbar?: BattingMatchupToolbarConfig;
  splitView: SplitView;
  onSplitViewChange: (v: SplitView) => void;
  venueFilter: StatsVenueFilter;
  onVenueFilterChange: (v: StatsVenueFilter) => void;
  runnersFilter: StatsRunnersFilterKey;
  onRunnersFilterChange: (v: StatsRunnersFilterKey) => void;
  disciplineSplit: SplitView;
  onDisciplineSplitChange: (v: SplitView) => void;
  disciplineRunners: StatsRunnersFilterKey;
  onDisciplineRunnersChange: (v: StatsRunnersFilterKey) => void;
  disciplineCount: BattingFinalCountBucketKey | null;
  onDisciplineCountChange: (v: BattingFinalCountBucketKey | null) => void;
  finalCountSplit: SplitView;
  onFinalCountSplitChange: (v: SplitView) => void;
  finalCountRunners: StatsRunnersFilterKey;
  onFinalCountRunnersChange: (v: StatsRunnersFilterKey) => void;
  finalCountBucket: BattingFinalCountBucketKey;
  onFinalCountBucketChange: (v: BattingFinalCountBucketKey) => void;
  pitchTypesSplit: SplitView;
  onPitchTypesSplitChange: (v: SplitView) => void;
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
  splitView: SplitView;
  onSplitViewChange: (v: SplitView) => void;
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
          onChange={(e) => onSplitViewChange(e.target.value as SplitView)}
          disabled={splitDisabled}
          title={
            splitDisabled
              ? "Split is off while a specific pitcher is selected (matchup line is already vs that arm)."
              : undefined
          }
          className="w-full min-w-[10rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Batting split view"
        >
          <option value="overall">Overall</option>
          <option value="vsL">vs LHP</option>
          <option value="vsR">vs RHP</option>
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

/** Team batting stats: one filterable main table, discipline + final-count sections with their own filters. */
export function TeamBattingStatsSections({
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
}: TeamBattingStatsSectionsProps) {
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
    BattingStatsSheetProps,
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
      ? "Sw%, Whiff%, Foul%, and BIP% use pitches thrown at the selected count; K% is the full-AB strikeout rate on PAs that reached that count."
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
              onChange={(e) => onSplitViewChange(e.target.value as SplitView)}
              disabled={splitDisabled}
              title={
                splitDisabled
                  ? "Split is off while a specific pitcher is selected (matchup line is already vs that arm)."
                  : undefined
              }
              className="w-full min-w-[10rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Batting split view"
            >
              <option value="overall">Overall</option>
              <option value="vsL">vs LHP</option>
              <option value="vsR">vs RHP</option>
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
              {matchupToolbar.pitchersFlat === undefined ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Opponent
                  </span>
                  <select
                    value={matchupToolbar.opponentKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      matchupToolbar.onOpponentChange(v);
                      matchupToolbar.onPitcherChange("");
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
                  Pitcher
                </span>
                <select
                  value={matchupToolbar.pitcherId}
                  onChange={(e) => matchupToolbar.onPitcherChange(e.target.value)}
                  disabled={matchupToolbar.pitchersFlat === undefined ? !matchupToolbar.opponentKey : false}
                  className="w-full min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Filter by opposing pitcher"
                >
                  <option value="">
                    {matchupToolbar.pitchersFlat !== undefined
                      ? "All pitchers"
                      : matchupToolbar.opponentKey
                        ? "All pitchers"
                        : "Choose opponent first"}
                  </option>
                  {(matchupToolbar.pitchersFlat ??
                    matchupToolbar.pitchersByOpponent[matchupToolbar.opponentKey] ??
                    []
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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

      <SectionBlock title="Batting stats">
        <BattingStatsSheet
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
          <BattingStatsSheet
            {...sharedSheet}
            lockedSplitView={disciplineSplit}
            lockedRunnersFilter={disciplineRunners}
            lockedVenueFilter={venueFilter}
            lockedFinalCountBucket={disciplineCount}
            lockedColumnMode="discipline"
            hideFilterFootnote={disciplineCount == null}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="By final count"
        description="Compare players on plate appearances that ended at the selected count (saved ball–strike count on the PA)."
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
          <BattingStatsSheet
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
        title={BAT_PITCH_TYPE_COLUMNS_MODE_LABEL}
        description={
          pitchTypesCount != null
            ? `${BAT_PITCH_TYPE_STATS_HELPER_TEXT} Mix uses pitches seen at the selected count state; AVG and K% need the full sample (clear count to view).`
            : BAT_PITCH_TYPE_STATS_HELPER_TEXT
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
          <BattingPitchTypeTeamSheet
            players={sheetProps.players ?? []}
            battingStatsWithSplits={sheetProps.battingStatsWithSplits ?? {}}
            pas={sheetProps.pas}
            pitchEvents={sheetProps.pitchEvents}
            games={sheetProps.games}
            splitView={pitchTypesSplit}
            venueFilter={venueFilter}
            runnersFilter={pitchTypesRunners}
            countState={pitchTypesCount}
            searchQuery={searchQuery}
            playerProfileHref={sheetProps.playerProfileHref}
            splitDisabled={splitDisabled}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title={BAT_PITCH_TYPE_DISCIPLINE_MODE_LABEL}
        description={
          pitchTypesCount != null
            ? `${BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT} Discipline rates use pitches seen at the selected count state; BIP mix uses the full sample (clear count to align).`
            : BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT
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
            ariaLabel="Discipline pitch-type count state"
            includeAll
            selected={pitchTypesCount}
            onSelect={onPitchTypesCountChange}
          />
          <BattingPitchTypeDisciplineTeamSheet
            players={sheetProps.players ?? []}
            battingStatsWithSplits={sheetProps.battingStatsWithSplits ?? {}}
            pas={sheetProps.pas}
            pitchEvents={sheetProps.pitchEvents}
            games={sheetProps.games}
            splitView={pitchTypesSplit}
            venueFilter={venueFilter}
            runnersFilter={pitchTypesRunners}
            countState={pitchTypesCount}
            searchQuery={searchQuery}
            playerProfileHref={sheetProps.playerProfileHref}
          />
        </div>
      </SectionBlock>
    </div>
  );
}
