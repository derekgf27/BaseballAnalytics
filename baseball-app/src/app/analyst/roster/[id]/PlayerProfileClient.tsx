"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHeight } from "@/lib/height";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import {
  battingSheetContactStatBorderLeft,
  battingSheetDataColumns,
  battingSheetDataColumnsForCountStateDiscipline,
  battingSheetDataColumnsForProfileCompact,
  battingSheetProfileCompactStatBorderLeft,
  battingSheetStandardStatBorderLeft,
  FINAL_COUNT_BUCKET_OPTIONS,
  formatProfileBattingSheetCell,
  type BattingSheetColumnMode,
  type ProfileBattingColumnDef,
} from "@/components/analyst/battingStatsSheetModel";

import { HitterProfileExportButton } from "@/components/shared/HitterProfileExportButton";
import {
  buildProfileRecentGameRows,
  PROFILE_RECENT_GAMES_COUNT,
  countPasWithPitchLog,
  profilePitchCoverageNote,
  type ProfileBattingLine,
} from "@/lib/profileBattingDisplay";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { PlayerSprayChartsSection } from "@/components/analyst/PlayerSprayChartsSection";
import {
  hasPitchingProfileStats,
  PlayerPitchingProfileSections,
} from "@/components/analyst/PlayerPitchingProfileSections";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { PlayerProfileHero } from "@/components/shared/PlayerProfileHero";
import { isDemoId } from "@/lib/db/mockData";
import { deletePlayerAction, getPlayerDeletionPreviewAction, updatePlayerAction } from "../actions";
import {
  PLAYER_ROSTER_STATUS_LABELS,
  resolveRosterStatus,
  trimStaffNotes,
} from "@/lib/playerRoster";
import {
  battingLineWithCountStateContact,
  buildBattingDisciplineLineAtCountState,
} from "@/lib/compute/statsSheetCountStateContact";
import type { StatsRunnersFilterKey } from "@/lib/types";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  BattingStatsWithSplits,
  Game,
  PitchEvent,
  PitchingStatsWithSplits,
  PlateAppearance,
  Player,
  PlayerDeletionPreview,
  Ratings,
} from "@/lib/types";

interface PlayerProfileClientProps {
  player: Player;
  ratings: Ratings;
  isOverridden: boolean;
  /** Full years old — computed on the server so SSR and hydration match. */
  ageYears?: number | null;
  /** Formatted birthday label from server (avoids locale mismatch on hydrate). */
  birthdayDisplay?: string | null;
  /** When true (Supabase configured), show delete control. */
  canEdit?: boolean;
  battingSplits: BattingStatsWithSplits | null;
  battingPas?: PlateAppearance[];
  battingPitchEvents?: PitchEvent[];
  pitchingSplits: PitchingStatsWithSplits | null;
  pitchingPas?: PlateAppearance[];
  pitchingPitchEvents?: PitchEvent[];
  spraySplits: AnalystPlayerSpraySplits | null;
  games?: Game[];
}

function PlayerStaffNotesSection({
  player,
  canEdit,
}: {
  player: Player;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(player.staff_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setNotes(player.staff_notes ?? "");
  }, [player.staff_notes]);

  const trimmed = notes.trim();
  const hasNotes = trimmed.length > 0;
  const [open, setOpen] = useState(false);
  if (!canEdit && !hasNotes) return null;

  const collapsedPreview =
    hasNotes && trimmed.length > 80 ? `${trimmed.slice(0, 80).trim()}…` : hasNotes ? trimmed : null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    try {
      const updated = await updatePlayerAction(player.id, {
        staff_notes: trimStaffNotes(notes),
      });
      if (!updated) {
        setSaveError("Could not save notes. Check your connection.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setSaveError("Could not save notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group card-tech min-w-0 rounded-lg border border-[var(--border)]/70"
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:hidden select-none sm:px-5 sm:py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            <span
              className="text-sm leading-none text-[var(--text)] transition-transform group-open:rotate-90"
              aria-hidden
            >
              ▸
            </span>
            Staff notes
          </span>
          {!open && collapsedPreview ? (
            <span className="max-w-xl truncate text-xs font-normal normal-case tracking-normal text-[var(--text-muted)]">
              {collapsedPreview}
            </span>
          ) : !open && canEdit && !hasNotes ? (
            <span className="text-xs font-normal normal-case tracking-normal text-[var(--text-faint)]">
              Add notes…
            </span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-[var(--border)]/60 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {canEdit ? (
          <>
            <label className="block min-w-0">
              <span className="sr-only">Staff notes for {player.name}</span>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSavedAt(null);
                  setSaveError(null);
                }}
                rows={4}
                maxLength={500}
                placeholder="Lineup role, matchup notes, availability context…"
                className="input-tech block w-full resize-y px-3 py-2.5 text-sm leading-relaxed"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="font-orbitron rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-95 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save notes"}
              </button>
              {savedAt != null ? (
                <span className="text-xs text-[var(--text-muted)]">Saved</span>
              ) : null}
              {saveError ? (
                <span className="text-xs text-[var(--danger)]" role="alert">
                  {saveError}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[var(--text-faint)]">
              Visible on this profile and the coach player card. Max 500 characters.
            </p>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{trimmed}</p>
        )}
      </div>
    </details>
  );
}

function profileLineWithCountState(
  line: BattingStats | null | undefined,
  playerId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  battingColumnMode: BattingSheetColumnMode,
  finalCountBucket: BattingFinalCountBucketKey | null,
  splitView: "overall" | "vsL" | "vsR",
  runnersFilter: StatsRunnersFilterKey
): BattingStats | undefined {
  if (!line) return undefined;
  return battingLineWithCountStateContact(
    line,
    playerId,
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    finalCountBucket,
    battingColumnMode
  );
}

type ProfileTableColumnContext = "default" | "profileCompact" | "countStateDiscipline";

type ProfileBattingTableRow = {
  label: string;
  line: ProfileBattingLine | undefined;
  hasSample?: boolean;
};

function useProfileBattingTableHelpers(
  columnMode: BattingSheetColumnMode,
  columnContext: ProfileTableColumnContext = "default"
) {
  const dataCols: ProfileBattingColumnDef[] =
    columnContext === "countStateDiscipline"
      ? battingSheetDataColumnsForCountStateDiscipline()
      : columnContext === "profileCompact"
        ? battingSheetDataColumnsForProfileCompact(columnMode)
        : battingSheetDataColumns(columnMode);
  const statBorderLeft = (key: ProfileBattingColumnDef["key"]) =>
    columnContext === "profileCompact" || columnContext === "countStateDiscipline"
      ? battingSheetProfileCompactStatBorderLeft(columnMode, key)
      : columnMode === "contact"
        ? battingSheetContactStatBorderLeft(key as Parameters<typeof battingSheetContactStatBorderLeft>[0])
        : battingSheetStandardStatBorderLeft(key as Parameters<typeof battingSheetStandardStatBorderLeft>[0]);
  const thAlign = (align: ProfileBattingColumnDef["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return { dataCols, statBorderLeft, thAlign };
}

function ProfileBattingSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{title}</h2>
      {subtitle ? <p className="text-xs leading-snug text-[var(--text-muted)]">{subtitle}</p> : null}
    </div>
  );
}

/** Season line only — fixed thead with data columns (no split/label column). */
function ProfileSeasonLineTable({
  title,
  line,
  baserunningSource,
}: {
  title: string;
  line: BattingStats | undefined;
  baserunningSource: BattingStats | undefined;
}) {
  const { dataCols, statBorderLeft, thAlign } = useProfileBattingTableHelpers("standard");
  const hasSample = line != null;

  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-4">
      <ProfileBattingSectionHeader title={title} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {dataCols.map((col) => (
                <th
                  key={col.key}
                  title={col.tooltip}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign(col.align)}${
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
                dataCols.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 tabular-nums text-[var(--text)] ${thAlign(col.align)}${
                      statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {formatProfileBattingSheetCell(col, line, baserunningSource)}
                  </td>
                ))
              ) : (
                <td colSpan={dataCols.length} className="py-2 px-3 italic text-[var(--text-faint)]">
                  No PAs
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Splits / final count / discipline rows — always includes a leading label column. */
function ProfileBattingLabeledTable({
  title,
  subtitle,
  footnote,
  columnMode,
  columnContext = "default",
  rowLabelHeader,
  rows,
  baserunningSource,
}: {
  title: string;
  subtitle?: string;
  footnote?: string;
  columnMode: BattingSheetColumnMode;
  columnContext?: ProfileTableColumnContext;
  rowLabelHeader: string;
  rows: ProfileBattingTableRow[];
  baserunningSource: BattingStats | undefined;
}) {
  const { dataCols, statBorderLeft, thAlign } = useProfileBattingTableHelpers(columnMode, columnContext);

  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-4">
      <ProfileBattingSectionHeader title={title} subtitle={subtitle} />
      {footnote ? (
        <p className="mt-2 text-[10px] leading-snug text-[var(--text-faint)]">{footnote}</p>
      ) : null}
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
              {dataCols.map((col) => (
                <th
                  key={col.key}
                  title={col.tooltip}
                  className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign(col.align)}${
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
                  dataCols.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 px-2 tabular-nums text-[var(--text)] ${thAlign(col.align)}${
                        statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                      }`}
                    >
                      {formatProfileBattingSheetCell(col, line, baserunningSource, line.countStatePitches)}
                    </td>
                  ))
                ) : (
                  <td colSpan={dataCols.length} className="py-2 px-2 text-right italic text-[var(--text-faint)]">
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

const PROFILE_SPLIT_ROWS = [
  { label: "vs LHP", key: "vsL" as const, runnersFilter: "all" as const },
  { label: "vs RHP", key: "vsR" as const, runnersFilter: "all" as const },
  { label: "RISP", key: "risp" as const, runnersFilter: "risp" as const },
];

const PROFILE_RUNNER_SITUATION_ROWS: {
  label: string;
  key: keyof NonNullable<BattingStatsWithSplits["runnerSituations"]>;
}[] = [
  { label: "Bases empty", key: "basesEmpty" },
  { label: "Runners on", key: "runnersOn" },
  { label: "RISP", key: "risp" },
  { label: "Bases loaded", key: "basesLoaded" },
];

function ProfileRecentActivitySection({
  playerId,
  battingPas,
  games,
}: {
  playerId: string;
  battingPas?: PlateAppearance[];
  games: Game[];
}) {
  const rows = useMemo(
    () => buildProfileRecentGameRows(playerId, battingPas, games, PROFILE_RECENT_GAMES_COUNT),
    [playerId, battingPas, games]
  );
  if (rows.length === 0) return null;

  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-4">
      <ProfileBattingSectionHeader
        title="Recent games"
        subtitle={`Last ${PROFILE_RECENT_GAMES_COUNT} games with a logged plate appearance (most recent first). Same H-AB and PA order as Record.`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Date
              </th>
              <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Game
              </th>
              <th className="py-2 pl-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Line
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.gameId} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap tabular-nums text-[var(--text)]">{r.dateLabel}</td>
                <td className="py-2 pr-4 text-[var(--text-muted)]">{r.matchup}</td>
                <td className="py-2 pl-4 font-medium text-[var(--accent)]">{r.statLine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlayerBattingProfileSections({
  playerId,
  battingSplits,
  battingPas,
  battingPitchEvents,
}: {
  playerId: string;
  battingSplits: BattingStatsWithSplits;
  battingPas?: PlateAppearance[];
  battingPitchEvents?: PitchEvent[];
}) {
  const overallBr = battingSplits.overall;
  const seasonPa = overallBr?.pa ?? 0;
  const pasWithPitchLog = useMemo(
    () => countPasWithPitchLog(playerId, battingPas, battingPitchEvents),
    [playerId, battingPas, battingPitchEvents]
  );
  const pitchCoverageNote = profilePitchCoverageNote(seasonPa, pasWithPitchLog);

  const seasonStandard = profileLineWithCountState(
    overallBr,
    playerId,
    battingPas,
    battingPitchEvents,
    "standard",
    null,
    "overall",
    "all"
  );

  const splitStandardRows: ProfileBattingTableRow[] = PROFILE_SPLIT_ROWS.map(({ label, key, runnersFilter }) => {
    const raw = battingSplits[key] ?? undefined;
    const splitView = key === "vsL" ? "vsL" : key === "vsR" ? "vsR" : "overall";
    return {
      label,
      line: profileLineWithCountState(
        raw,
        playerId,
        battingPas,
        battingPitchEvents,
        "standard",
        null,
        splitView,
        runnersFilter
      ),
      hasSample: raw != null,
    };
  });

  const disciplineSeason = profileLineWithCountState(
    overallBr,
    playerId,
    battingPas,
    battingPitchEvents,
    "contact",
    null,
    "overall",
    "all"
  );

  const disciplineSplitRows: ProfileBattingTableRow[] = PROFILE_SPLIT_ROWS.map(({ label, key, runnersFilter }) => {
    const raw = battingSplits[key] ?? undefined;
    const splitView = key === "vsL" ? "vsL" : key === "vsR" ? "vsR" : "overall";
    return {
      label,
      line: profileLineWithCountState(
        raw,
        playerId,
        battingPas,
        battingPitchEvents,
        "contact",
        null,
        splitView,
        runnersFilter
      ),
      hasSample: raw != null,
    };
  });

  const finalCountRows: ProfileBattingTableRow[] = FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
    const raw = battingSplits.statsByFinalCount?.overall?.[value] ?? undefined;
    return {
      label,
      line: raw ?? undefined,
      hasSample: raw != null && (raw.pa ?? 0) > 0,
    };
  });

  const runnerSituationRows: ProfileBattingTableRow[] = useMemo(() => {
    const rs = battingSplits.runnerSituations;
    if (!rs) return [];
    return PROFILE_RUNNER_SITUATION_ROWS.map(({ label, key }) => {
      const raw = rs[key]?.combined ?? undefined;
      return {
        label,
        line: profileLineWithCountState(
          raw,
          playerId,
          battingPas,
          battingPitchEvents,
          "standard",
          null,
          "overall",
          key
        ),
        hasSample: raw != null,
      };
    });
  }, [battingSplits.runnerSituations, playerId, battingPas, battingPitchEvents]);

  const disciplineByCountRows: ProfileBattingTableRow[] = FINAL_COUNT_BUCKET_OPTIONS.map(({ value, label }) => {
    const line = buildBattingDisciplineLineAtCountState(
      playerId,
      battingPas,
      battingPitchEvents,
      "overall",
      "all",
      value
    );
    return {
      label,
      line,
      hasSample: line != null && (line.pa ?? 0) > 0,
    };
  });

  const disciplineSubtitle = [
    "Season and platoon splits — rates use all pitches in those PAs (not one count).",
    pitchCoverageNote,
  ]
    .filter(Boolean)
    .join(" ");

  const countStateSubtitle = [
    "Swing, whiff, foul, and BIP rates on every pitch at each count. PA at 0-0 is every plate appearance; # is pitches at that count.",
    pitchCoverageNote,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <ProfileSeasonLineTable title="Season line" line={seasonStandard} baserunningSource={overallBr} />

      <ProfileBattingLabeledTable
        title="Batting splits"
        columnMode="standard"
        columnContext="profileCompact"
        rowLabelHeader="Split"
        rows={splitStandardRows}
        baserunningSource={overallBr}
      />

      {runnerSituationRows.length > 0 ? (
        <ProfileBattingLabeledTable
          title="By base state"
          subtitle="Standard line by starting base state (combined vs all pitcher hands)."
          columnMode="standard"
          columnContext="profileCompact"
          rowLabelHeader="Situation"
          rows={runnerSituationRows}
          baserunningSource={overallBr}
        />
      ) : null}

      <ProfileBattingLabeledTable
        title="Discipline & BIP"
        subtitle={disciplineSubtitle}
        columnMode="contact"
        columnContext="profileCompact"
        rowLabelHeader="Line"
        rows={[
          { label: "Season", line: disciplineSeason, hasSample: overallBr != null },
          ...disciplineSplitRows,
        ]}
        baserunningSource={overallBr}
      />

      <ProfileBattingLabeledTable
        title="By final count"
        subtitle="Standard line for plate appearances that ended at each ball–strike count."
        footnote="Rows sum to season PA — each plate appearance ends at exactly one count."
        columnMode="standard"
        columnContext="profileCompact"
        rowLabelHeader="Count"
        rows={finalCountRows}
        baserunningSource={overallBr}
      />

      <ProfileBattingLabeledTable
        title="Discipline & BIP by count state"
        subtitle={countStateSubtitle}
        columnMode="contact"
        columnContext="countStateDiscipline"
        rowLabelHeader="Count"
        rows={disciplineByCountRows}
        baserunningSource={overallBr}
      />
    </>
  );
}

export function PlayerProfileClient({
  player,
  ageYears = null,
  birthdayDisplay = null,
  battingSplits,
  battingPas = [],
  battingPitchEvents = [],
  pitchingSplits,
  pitchingPas: _pitchingPas = [],
  pitchingPitchEvents: _pitchingPitchEvents = [],
  spraySplits,
  games = [],
  canEdit = false,
}: PlayerProfileClientProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<PlayerDeletionPreview | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useEffect(() => {
    if (!deleteOpen) {
      setDeletePreview(null);
      return;
    }
    let cancelled = false;
    void getPlayerDeletionPreviewAction(player.id).then((p) => {
      if (!cancelled) setDeletePreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [deleteOpen, player.id]);

  const isSwitch = player.bats?.toUpperCase().startsWith("S") ?? false;

  const heightWeight =
    player.height_in != null || player.weight_lb != null
      ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${player.height_in != null && player.weight_lb != null ? " " : ""}${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
      : null;

  const rosterStatus = resolveRosterStatus(player);
  const secondaryFacts = [
    { label: "Status", value: PLAYER_ROSTER_STATUS_LABELS[rosterStatus] },
    heightWeight ? { label: "Height · Weight", value: heightWeight } : null,
    player.hometown?.trim() ? { label: "Hometown", value: player.hometown.trim() } : null,
    birthdayDisplay ? { label: "Birthday", value: birthdayDisplay } : null,
    ageYears != null ? { label: "Age", value: `${ageYears} yrs` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const profileDeleteDescription =
    !deleteOpen || !deletePreview
      ? deleteOpen
        ? "Loading…"
        : ""
      : [
          deletePreview.batterPlateAppearances > 0
            ? `${player.name} has ${deletePreview.batterPlateAppearances} plate appearance(s) as batter. They will be removed from the active roster but kept in historical game logs.`
            : `Permanently delete ${player.name}?`,
          deletePreview.gameLineups > 0
            ? `${deletePreview.gameLineups} game lineup slot(s) will be removed.`
            : null,
          deletePreview.savedLineupSlots > 0
            ? `${deletePreview.savedLineupSlots} saved lineup template slot(s) will be removed.`
            : null,
          deletePreview.batterPlateAppearances > 0
            ? "This keeps past stats/history intact."
            : "Credits as pitcher on old PAs will be cleared. Baserunning events where they were the runner will be removed. This cannot be undone.",
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div className="space-y-6">
      <PlayerProfileHero
        player={player}
        secondaryFacts={secondaryFacts}
        jerseyTrailing={<HitterProfileExportButton player={player} enabled={battingSplits != null} />}
      />

      {battingSplits && battingPas.length > 0 ? (
        <ProfileRecentActivitySection playerId={player.id} battingPas={battingPas} games={games} />
      ) : null}

      <PlayerStaffNotesSection player={player} canEdit={canEdit && !isDemoId(player.id)} />

      {battingSplits ? (
        <PlayerBattingProfileSections
          playerId={player.id}
          battingSplits={battingSplits}
          battingPas={battingPas}
          battingPitchEvents={battingPitchEvents}
        />
      ) : null}

      {pitchingSplits && hasPitchingProfileStats(pitchingSplits) ? (
        <PlayerPitchingProfileSections
          playerId={player.id}
          pitchingSplits={pitchingSplits}
          pitchingPas={_pitchingPas}
          pitchingPitchEvents={_pitchingPitchEvents}
        />
      ) : null}

      <PlayerSprayChartsSection spraySplits={spraySplits} isSwitch={isSwitch} />

      {canEdit && !isDemoId(player.id) && (
        <section className="card-tech rounded-lg border border-[var(--danger)]/40 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--danger)]">
            Remove player
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Delete this profile from the database. If the player has historical batting plate appearances, we remove
            them from the active roster while preserving past game logs.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="font-display mt-3 rounded-lg border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/15"
          >
            Delete player
          </button>
          {deleteError && (
            <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
              {deleteError}
            </p>
          )}
          <ConfirmDeleteDialog
            open={deleteOpen}
            onClose={() => !deletePending && setDeleteOpen(false)}
            title="Delete player?"
            description={profileDeleteDescription}
            confirmLabel="Delete player"
            pending={deletePending}
            pendingLabel="Deleting…"
            confirmDisabled={deletePreview == null}
            onConfirm={async () => {
              if (deletePreview == null) return;
              setDeletePending(true);
              setDeleteError(null);
              const result = await deletePlayerAction(player.id);
              setDeletePending(false);
              setDeleteOpen(false);
              if (result.ok) router.push("/analyst/roster");
              else setDeleteError(result.error);
            }}
          />
        </section>
      )}
    </div>
  );
}
