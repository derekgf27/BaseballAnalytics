"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatHeight } from "@/lib/height";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import {
  battingSheetContactStatBorderLeft,
  battingSheetDataColumns,
  battingSheetStandardStatBorderLeft,
  FINAL_COUNT_BUCKET_OPTIONS,
  formatBattingSheetDataCell,
  type BattingSheetColumnMode,
} from "@/components/analyst/battingStatsSheetModel";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { PlayerSprayChartsSection } from "@/components/analyst/PlayerSprayChartsSection";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { isDemoId } from "@/lib/db/mockData";
import { deletePlayerAction, getPlayerDeletionPreviewAction } from "../actions";
import { analystComparePlayersHref } from "@/lib/analystRoutes";
import type {
  BattingFinalCountBucketKey,
  BattingStatsWithSplits,
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
  spraySplits: AnalystPlayerSpraySplits | null;
}

export function PlayerBattingProfileSections({
  battingSplits,
  battingColumnMode,
  setBattingColumnMode,
}: {
  battingSplits: BattingStatsWithSplits;
  battingColumnMode: BattingSheetColumnMode;
  setBattingColumnMode: (mode: BattingSheetColumnMode) => void;
}) {
  const [finalCountBucket, setFinalCountBucket] = useState<BattingFinalCountBucketKey | null>(null);
  const dataCols = battingSheetDataColumns(battingColumnMode);
  const statBorderLeft = (key: (typeof dataCols)[number]["key"]) =>
    battingColumnMode === "contact"
      ? battingSheetContactStatBorderLeft(key)
      : battingSheetStandardStatBorderLeft(key);
  const thAlign = (align: (typeof dataCols)[number]["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const overallBr = battingSplits.overall;
  const seasonLineStats =
    finalCountBucket != null
      ? battingSplits.statsByFinalCount?.overall?.[finalCountBucket] ?? undefined
      : overallBr;
  return (
    <>
      <section className="card-tech rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Season line</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Columns</span>
              <select
                value={battingColumnMode}
                onChange={(e) => setBattingColumnMode(e.target.value as BattingSheetColumnMode)}
                className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Stat column set"
              >
                <option value="standard">Standard</option>
                <option value="contact">Discipline &amp; BIP</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Final count</span>
              <select
                value={finalCountBucket ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                }}
                className="max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Filter season line and splits to PAs ending at this final count"
              >
                <option value="">All PAs</option>
                {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
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
                {dataCols.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 tabular-nums text-[var(--text)] ${thAlign(col.align)}${
                      statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {formatBattingSheetDataCell(col, seasonLineStats, overallBr)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="card-tech rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Batting splits</h2>
          <label className="flex min-w-0 items-center gap-2 text-sm text-white">
            <span className="shrink-0">Columns</span>
            <select
              value={battingColumnMode}
              onChange={(e) => setBattingColumnMode(e.target.value as BattingSheetColumnMode)}
              className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Stat column set for splits"
            >
              <option value="standard">Standard</option>
              <option value="contact">Discipline &amp; BIP</option>
            </select>
          </label>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th
                  title={BATTING_STAT_HEADER_TOOLTIPS.split}
                  className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]"
                >
                  Split
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
              {[
                { label: "vs LHP", s: battingSplits.vsL, countLine: battingSplits.statsByFinalCount?.vsL },
                { label: "vs RHP", s: battingSplits.vsR, countLine: battingSplits.statsByFinalCount?.vsR },
                { label: "RISP", s: battingSplits.risp, countLine: battingSplits.statsByFinalCount?.risp },
              ].map(({ label, s, countLine }) => {
                const splitLine =
                  finalCountBucket != null
                    ? countLine?.[finalCountBucket] ?? undefined
                    : s ?? undefined;
                return (
                <tr key={label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                  {s ? (
                    dataCols.map((col) => (
                      <td
                        key={col.key}
                        className={`py-2 px-2 tabular-nums text-[var(--text)] ${thAlign(col.align)}${
                          statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                        }`}
                      >
                        {formatBattingSheetDataCell(col, splitLine, overallBr)}
                      </td>
                    ))
                  ) : (
                    <td
                      colSpan={dataCols.length}
                      className="py-2 px-2 text-right italic text-[var(--text-faint)]"
                    >
                      No PAs
                    </td>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function PlayerProfileClient({
  player,
  ageYears = null,
  birthdayDisplay = null,
  battingSplits,
  spraySplits,
  canEdit = false,
}: PlayerProfileClientProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<PlayerDeletionPreview | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [battingColumnMode, setBattingColumnMode] = useState<BattingSheetColumnMode>("standard");
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

  const normalizeHand = (hand: string | null | undefined, isBat: boolean): string | null => {
    if (hand == null || hand === "") return null;
    const code = hand.toUpperCase();
    if (code.startsWith("L")) return "Left";
    if (code.startsWith("R")) return "Right";
    if (code.startsWith("S")) return "Switch";
    return hand;
  };

  const batsLabel = normalizeHand(player.bats, true);
  const throwsLabel = normalizeHand(player.throws, false);

  const info = {
    jersey: player.jersey != null && player.jersey !== "" ? `#${player.jersey}` : null,
    positions: player.positions?.length ? player.positions.join(", ") : null,
    batsThrows:
      batsLabel != null || throwsLabel != null
        ? `${batsLabel ?? "—"} / ${throwsLabel ?? "—"}`
        : null,
    heightWeight:
      player.height_in != null || player.weight_lb != null
        ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${player.height_in != null && player.weight_lb != null ? " " : ""}${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
        : null,
    hometown: player.hometown?.trim() || null,
    birthday: birthdayDisplay,
    age: ageYears != null ? `${ageYears} yrs` : null,
  };

  const rows = [
    info.jersey && { label: "Jersey", value: info.jersey },
    info.positions && { label: "Positions", value: info.positions },
    info.batsThrows && { label: "Bats / Throws", value: info.batsThrows },
    info.heightWeight && { label: "Height · Weight", value: info.heightWeight },
    info.hometown && { label: "Hometown", value: info.hometown },
    info.birthday && { label: "Birthday", value: info.birthday },
    info.age && { label: "Age", value: info.age },
  ].filter(Boolean) as { label: string; value: string }[];

  const deleteConfirmBlocked =
    deletePreview != null && deletePreview.batterPlateAppearances > 0;
  const profileDeleteDescription =
    !deleteOpen || !deletePreview
      ? deleteOpen
        ? "Loading…"
        : ""
      : deletePreview.batterPlateAppearances > 0
        ? `This player has ${deletePreview.batterPlateAppearances} plate appearance(s) as batter. Remove or edit those PAs in game logs before deleting.`
        : [
            `Permanently delete ${player.name}?`,
            deletePreview.gameLineups > 0
              ? `${deletePreview.gameLineups} game lineup slot(s) will be removed.`
              : null,
            deletePreview.savedLineupSlots > 0
              ? `${deletePreview.savedLineupSlots} saved lineup template slot(s) will be removed.`
              : null,
            "Credits as pitcher on old PAs will be cleared. Baserunning events where they were the runner will be removed. This cannot be undone.",
          ]
            .filter(Boolean)
            .join(" ");

  return (
    <div className="space-y-6">
      <div className="card-tech flex flex-col gap-5 p-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-2 sm:w-36">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xl font-bold text-[var(--accent)] sm:h-24 sm:w-24 sm:text-2xl">
            {player.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left sm:flex-none sm:text-center">
            <p className="text-base font-semibold text-[var(--text)] sm:text-lg">{player.name}</p>
            <Link
              href={analystComparePlayersHref({ p1: player.id })}
              className="mt-1 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Compare with…
            </Link>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ label, value }) => (
              <div key={label} className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {label}
              </p>
                <p className="mt-0.5 break-words text-sm font-semibold text-[var(--text)] sm:text-base">
                  {value}
                </p>
            </div>
          ))}
          </div>
        </div>
      </div>

      {battingSplits ? (
        <PlayerBattingProfileSections
          battingSplits={battingSplits}
          battingColumnMode={battingColumnMode}
          setBattingColumnMode={setBattingColumnMode}
        />
      ) : null}

      <PlayerSprayChartsSection spraySplits={spraySplits} isSwitch={isSwitch} />

      {canEdit && !isDemoId(player.id) && (
        <section className="card-tech rounded-lg border border-[var(--danger)]/40 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--danger)]">
            Remove player
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Delete this profile from the database. You cannot delete a player who still has plate appearances recorded
            as the batter.
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
            confirmDisabled={deletePreview == null || deleteConfirmBlocked}
            onConfirm={async () => {
              if (deleteConfirmBlocked || deletePreview == null) return;
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
