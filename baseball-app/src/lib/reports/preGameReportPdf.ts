import type { Game } from "@/lib/types";
import { downloadElementAsPdf } from "@/lib/reports/htmlElementPdf";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";

function safeFilenamePart(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48) || "pregame"
  );
}

export function preGameReportPdfFilename(game: Game): string {
  const datePart = game.date.replace(/[^\d-]/g, "").slice(0, 10);
  return `pregame_${datePart}_${safeFilenamePart(matchupLabelUsFirst(game, true))}.pdf`;
}

/** Export the on-screen pre-game report (same layout as the web preview / print styles). */
export async function downloadPreGameReportPdf(element: HTMLElement, game: Game): Promise<void> {
  await downloadElementAsPdf(element, preGameReportPdfFilename(game), {
    orientation: "landscape",
    splitByTopLevelSections: true,
  });
}
