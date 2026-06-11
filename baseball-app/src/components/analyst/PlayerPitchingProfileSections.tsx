"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PitchTypeBaaTable } from "@/components/analyst/PitchTypeBaaTable";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import {
  PITCHING_COMPARE_CONTACT_COLUMNS,
  PITCHING_COMPARE_FINAL_COUNT_COLUMNS,
  PITCHING_COMPARE_STANDARD_COLUMNS,
  formatPitchingCompareCell,
  formatPitchingCountStateDisciplineCell,
  pitchingCompareContactStatBorderLeft,
  pitchingCompareCountStateDisciplineBorderLeft,
  pitchingCompareCountStateDisciplineColumns,
  pitchingCompareStatBorderLeft,
  type PitchCompareColumnDef,
  type PitchProfileDisciplineColumnDef,
} from "@/components/analyst/pitchingStatsSheetModel";
import { buildPitchingDisciplineLineAtCountState } from "@/lib/compute/statsSheetCountStateContact";
import { countPitcherPasWithPitchLog, profilePitchCoverageNote } from "@/lib/profileBattingDisplay";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type {
  BattingFinalCountBucketKey,
  PitchEvent,
  PitchingStats,
  PitchingStatsWithSplits,
  PlateAppearance,
} from "@/lib/types";

type PitchingProfilePlatoon = "overall" | "vsLHB" | "vsRHB";

type ProfilePitchingTableRow = {
  label: string;
  line: PitchingStats | undefined;
  hasSample?: boolean;
};

type ProfilePitchingCountStateRow = {
  label: string;
  line: PitchingStats | undefined;
  countStatePitches?: number;
  hasSample?: boolean;
};

const PITCHING_PLATOON_SPLIT_ROWS: {
  label: string;
  line: (splits: PitchingStatsWithSplits) => PitchingStats | null | undefined;
}[] = [
  { label: "vs LHB", line: (s) => s.vsLHB },
  { label: "vs RHB", line: (s) => s.vsRHB },
];

const PITCHING_RUNNER_SITUATION_ROWS: {
  label: string;
  key: keyof NonNullable<PitchingStatsWithSplits["runnerSituations"]>;
}[] = [
  { label: "Bases empty", key: "basesEmpty" },
  { label: "Runners on", key: "runnersOn" },
  { label: "RISP", key: "risp" },
  { label: "Bases loaded", key: "basesLoaded" },
];

function pitchingLineForPlatoon(
  splits: PitchingStatsWithSplits,
  platoon: PitchingProfilePlatoon
): PitchingStats | undefined {
  if (platoon === "vsLHB") return splits.vsLHB ?? undefined;
  if (platoon === "vsRHB") return splits.vsRHB ?? undefined;
  return splits.overall;
}

function finalCountMapForPlatoon(
  splits: PitchingStatsWithSplits,
  platoon: PitchingProfilePlatoon
): Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> | undefined {
  if (platoon === "vsLHB") return splits.statsByFinalCount?.vsLHB;
  if (platoon === "vsRHB") return splits.statsByFinalCount?.vsRHB;
  return splits.statsByFinalCount?.overall;
}

/** True when the pitcher has logged at least one game or inning. */
export function hasPitchingProfileStats(splits: PitchingStatsWithSplits | null): boolean {
  if (!splits) return false;
  const o = splits.overall;
  return o.g > 0 || o.ip > 0;
}

function ProfilePitchingSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{title}</h2>
      {subtitle ? <p className="text-xs leading-snug text-[var(--text-muted)]">{subtitle}</p> : null}
    </div>
  );
}

function ProfilePitchingPlatoonSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: PitchingProfilePlatoon;
  onChange: (value: PitchingProfilePlatoon) => void;
  ariaLabel: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-white">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Split</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PitchingProfilePlatoon)}
        className="max-w-[8rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        aria-label={ariaLabel}
      >
        <option value="overall">Overall</option>
        <option value="vsLHB">vs LHB</option>
        <option value="vsRHB">vs RHB</option>
      </select>
    </label>
  );
}

function ProfilePitchingDataTable({
  columns,
  line,
  statBorderLeft,
}: {
  columns: PitchCompareColumnDef[];
  line: PitchingStats | undefined;
  statBorderLeft: (key: PitchCompareColumnDef["key"]) => boolean;
}) {
  const thAlign = "text-right";
  const hasSample = line != null;

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-[var(--border)]">
          {columns.map((col) => (
            <th
              key={col.key}
              title={col.tooltip}
              className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign}${
                statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
              }`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[var(--border)] last:border-0">
          {hasSample && line ? (
            columns.map((col) => (
              <td
                key={col.key}
                className={`py-2 px-3 tabular-nums text-[var(--text)] ${thAlign}${
                  statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                }`}
              >
                {formatPitchingCompareCell(col, line)}
              </td>
            ))
          ) : (
            <td colSpan={columns.length} className="py-2 px-3 italic text-[var(--text-faint)]">
              No PAs
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );
}

function ProfilePitchingLabeledTable({
  title,
  subtitle,
  footnote,
  rowLabelHeader,
  rows,
  columns,
  statBorderLeft,
  headerEnd,
}: {
  title: string;
  subtitle?: string;
  footnote?: string;
  rowLabelHeader: string;
  rows: ProfilePitchingTableRow[];
  columns: PitchCompareColumnDef[];
  statBorderLeft: (key: PitchCompareColumnDef["key"]) => boolean;
  headerEnd?: ReactNode;
}) {
  const thAlign = "text-right";

  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <ProfilePitchingSectionHeader title={title} subtitle={subtitle} />
        {headerEnd ? <div className="shrink-0">{headerEnd}</div> : null}
      </div>
      {footnote ? <p className="mt-2 text-[10px] leading-snug text-[var(--text-faint)]">{footnote}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                title={BATTING_STAT_HEADER_TOOLTIPS.split}
                className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]"
              >
                {rowLabelHeader}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  title={col.tooltip}
                  className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign}${
                    statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, line, hasSample = true }) => (
              <tr key={label} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                {hasSample && line ? (
                  columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 px-2 tabular-nums text-[var(--text)] ${thAlign}${
                        statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                      }`}
                    >
                      {formatPitchingCompareCell(col, line)}
                    </td>
                  ))
                ) : (
                  <td colSpan={columns.length} className="py-2 px-2 text-right italic text-[var(--text-faint)]">
                    No PAs
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfilePitchingCountStateDisciplineTable({
  title,
  subtitle,
  footnote,
  rows,
  columns,
}: {
  title: string;
  subtitle?: string;
  footnote?: string;
  rows: ProfilePitchingCountStateRow[];
  columns: PitchProfileDisciplineColumnDef[];
}) {
  const thAlign = "text-right";

  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-4">
      <ProfilePitchingSectionHeader title={title} subtitle={subtitle} />
      {footnote ? <p className="mt-2 text-[10px] leading-snug text-[var(--text-faint)]">{footnote}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                title={BATTING_STAT_HEADER_TOOLTIPS.split}
                className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]"
              >
                Count
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  title={col.tooltip}
                  className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign}${
                    pitchingCompareCountStateDisciplineBorderLeft(col.key)
                      ? " border-l border-[var(--border)]"
                      : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, line, countStatePitches, hasSample = true }) => (
              <tr key={label} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                {hasSample && line ? (
                  columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 px-2 tabular-nums text-[var(--text)] ${thAlign}${
                        pitchingCompareCountStateDisciplineBorderLeft(col.key)
                          ? " border-l border-[var(--border)]"
                          : ""
                      }`}
                    >
                      {formatPitchingCountStateDisciplineCell(col, line, countStatePitches)}
                    </td>
                  ))
                ) : (
                  <td colSpan={columns.length} className="py-2 px-2 text-right italic text-[var(--text-faint)]">
                    No PAs
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlayerPitchingProfileSections({
  playerId,
  pitchingSplits,
  pitchingPas,
  pitchingPitchEvents,
}: {
  playerId: string;
  pitchingSplits: PitchingStatsWithSplits;
  pitchingPas?: PlateAppearance[];
  pitchingPitchEvents?: PitchEvent[];
}) {
  const [baaPlatoon, setBaaPlatoon] = useState<PitchingProfilePlatoon>("overall");
  const [finalCountPlatoon, setFinalCountPlatoon] = useState<PitchingProfilePlatoon>("overall");
  const standardCols = PITCHING_COMPARE_STANDARD_COLUMNS;
  const countStateDisciplineCols = pitchingCompareCountStateDisciplineColumns();
  const overall = pitchingSplits.overall;
  const seasonBf = overall.rates.pa ?? 0;
  const pasWithPitchLog = useMemo(
    () => countPitcherPasWithPitchLog(playerId, pitchingPas, pitchingPitchEvents),
    [playerId, pitchingPas, pitchingPitchEvents]
  );
  const pitchCoverageNote = profilePitchCoverageNote(seasonBf, pasWithPitchLog);

  const splitStandardRows: ProfilePitchingTableRow[] = PITCHING_PLATOON_SPLIT_ROWS.map(({ label, line }) => {
    const raw = line(pitchingSplits);
    return { label, line: raw ?? undefined, hasSample: raw != null };
  });

  const runnerSituationRows: ProfilePitchingTableRow[] = useMemo(() => {
    const rs = pitchingSplits.runnerSituations;
    if (!rs) return [];
    return PITCHING_RUNNER_SITUATION_ROWS.map(({ label, key }) => {
      const raw = rs[key]?.combined ?? undefined;
      return { label, line: raw ?? undefined, hasSample: raw != null };
    });
  }, [pitchingSplits.runnerSituations]);

  const disciplineRows: ProfilePitchingTableRow[] = [
    {
      label: "vs LHB",
      line: pitchingSplits.vsLHB ?? undefined,
      hasSample: pitchingSplits.vsLHB != null,
    },
    {
      label: "vs RHB",
      line: pitchingSplits.vsRHB ?? undefined,
      hasSample: pitchingSplits.vsRHB != null,
    },
    {
      label: "RISP",
      line: pitchingSplits.runnerSituations?.risp?.combined ?? undefined,
      hasSample: pitchingSplits.runnerSituations?.risp?.combined != null,
    },
  ];

  const finalCountRows: ProfilePitchingTableRow[] = useMemo(() => {
    const countMap = finalCountMapForPlatoon(pitchingSplits, finalCountPlatoon);
    return FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
      const raw = countMap?.[value] ?? undefined;
      return {
        label,
        line: raw ?? undefined,
        hasSample: raw != null && (raw.rates.pa ?? 0) > 0,
      };
    });
  }, [pitchingSplits, finalCountPlatoon]);

  const baaSampleStats = useMemo(() => {
    return pitchingLineForPlatoon(pitchingSplits, baaPlatoon) ?? pitchingSplits.overall;
  }, [pitchingSplits, baaPlatoon]);

  const disciplineByCountRows: ProfilePitchingCountStateRow[] = useMemo(() => {
    return FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
      const line = buildPitchingDisciplineLineAtCountState(
        playerId,
        pitchingPas,
        pitchingPitchEvents,
        "overall",
        "all",
        value
      );
      return {
        label,
        line,
        countStatePitches: line?.countStatePitches,
        hasSample: (line?.countStatePitches ?? 0) > 0,
      };
    });
  }, [playerId, pitchingPas, pitchingPitchEvents]);

  const countStateSubtitle = [
    "Pitches and rates use every logged pitch thrown at that ball–strike count.",
    pitchCoverageNote,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <section className="card-tech rounded-lg border border-[var(--border)] p-4">
        <ProfilePitchingSectionHeader title="Season line" />
        <div className="mt-3 overflow-x-auto">
          <ProfilePitchingDataTable
            columns={standardCols}
            line={overall}
            statBorderLeft={pitchingCompareStatBorderLeft}
          />
        </div>
      </section>

      <PitchTypeBaaTable
        rates={baaSampleStats.rates}
        showAllPitchTypes
        platoonControl={
          <ProfilePitchingPlatoonSelect
            value={baaPlatoon}
            onChange={setBaaPlatoon}
            ariaLabel="Platoon split for pitch type stats"
          />
        }
      />

      <ProfilePitchingLabeledTable
        title="Pitching splits"
        rowLabelHeader="Split"
        rows={splitStandardRows}
        columns={standardCols}
        statBorderLeft={pitchingCompareStatBorderLeft}
      />

      {runnerSituationRows.length > 0 ? (
        <ProfilePitchingLabeledTable
          title="By base state"
          subtitle="Standard line by starting base state (combined vs all batter hands)."
          rowLabelHeader="Situation"
          rows={runnerSituationRows}
          columns={standardCols}
          statBorderLeft={pitchingCompareStatBorderLeft}
        />
      ) : null}

      <ProfilePitchingLabeledTable
        title="Discipline & contact"
        subtitle="Swing, whiff, foul, and BIP rates use every logged pitch in each split."
        rowLabelHeader="Split"
        rows={disciplineRows}
        columns={PITCHING_COMPARE_CONTACT_COLUMNS}
        statBorderLeft={pitchingCompareContactStatBorderLeft}
      />

      <ProfilePitchingLabeledTable
        title="By final count"
        subtitle="Standard line for plate appearances that ended at each ball–strike count."
        footnote="Rows sum to batters faced in the selected split — each plate appearance ends at exactly one count."
        rowLabelHeader="Count"
        rows={finalCountRows}
        columns={PITCHING_COMPARE_FINAL_COUNT_COLUMNS}
        statBorderLeft={pitchingCompareStatBorderLeft}
        headerEnd={
          <ProfilePitchingPlatoonSelect
            value={finalCountPlatoon}
            onChange={setFinalCountPlatoon}
            ariaLabel="Platoon split for by final count"
          />
        }
      />

      <ProfilePitchingCountStateDisciplineTable
        title="Discipline & contact by count state"
        subtitle={countStateSubtitle}
        rows={disciplineByCountRows}
        columns={countStateDisciplineCols}
      />
    </>
  );
}
