"use client";

import { useState } from "react";
import { fetchHitterReportBundleAction } from "@/app/analyst/reports/actions";
import { downloadHitterReportPdf } from "@/lib/reports/playerReportPdf";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import type { Player } from "@/lib/types";

const btnClass =
  "font-display inline-flex min-h-[44px] items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

export function HitterProfileExportButton({
  player,
  enabled = true,
  label = "Export report",
}: {
  player: Player;
  enabled?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || !isClubRosterPlayer(player)) return null;

  const onExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHitterReportBundleAction([player.id]);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      await downloadHitterReportPdf(res, { compare: false });
    } catch {
      setError("Could not build PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
      <button
        type="button"
        onClick={() => void onExport()}
        disabled={loading}
        className={btnClass}
      >
        {loading ? "Building PDF…" : label}
      </button>
      {error ? (
        <p className="max-w-[14rem] text-right text-xs text-[var(--danger)] sm:text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
