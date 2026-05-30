import type { Game } from "@/lib/types";
import { downloadElementAsPdf } from "@/lib/reports/htmlElementPdf";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";

function safeFilenamePart(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48) || "postgame"
  );
}

export function postGameReportPdfFilename(game: Game): string {
  const datePart = game.date.replace(/[^\d-]/g, "").slice(0, 10);
  return `postgame_${datePart}_${safeFilenamePart(matchupLabelUsFirst(game, true))}.pdf`;
}

/** Export the on-screen post-game report (raster capture, same workflow as pre-game). */
export async function downloadPostGameReportPdf(element: HTMLElement, game: Game): Promise<void> {
  await downloadElementAsPdf(element, postGameReportPdfFilename(game), {
    orientation: "landscape",
    /** Page 1: box score + stats; page 2: analyst notes. */
    splitByTopLevelSections: true,
  });
}
