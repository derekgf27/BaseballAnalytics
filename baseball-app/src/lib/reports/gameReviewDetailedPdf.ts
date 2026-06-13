import type { Game } from "@/lib/types";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import { sanitizeGameReviewPdfFilename } from "@/lib/gameReviewPdfInsights";
import {
  downloadElementAsPdf,
  type PdfExportProgress,
} from "@/lib/reports/htmlElementPdf";

export function gameReviewDetailedPdfFilename(game: Game): string {
  return `${sanitizeGameReviewPdfFilename(game)}-detailed.pdf`;
}

export type GameReviewDetailedPdfOptions = {
  onProgress?: (progress: PdfExportProgress) => void;
};

/** Raster PDF: both teams with batting, per-batter pitch blocks, pitching, and pitch mix. */
export async function downloadGameReviewDetailedPdf(
  element: HTMLElement,
  game: Game,
  options: GameReviewDetailedPdfOptions = {}
): Promise<void> {
  const footerLeft = `${formatDateMMDDYYYY(game.date)} · ${matchupLabelUsFirst(game, true)}`;
  await downloadElementAsPdf(element, gameReviewDetailedPdfFilename(game), {
    orientation: "portrait",
    splitByTopLevelSections: true,
    footerLeft,
    onProgress: options.onProgress,
  });
}
