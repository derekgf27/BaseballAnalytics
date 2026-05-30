import { downloadElementAsPdf } from "@/lib/reports/htmlElementPdf";

function safeFilenamePart(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48) || "team_trends"
  );
}

export function teamTrendsReportPdfFilename(): string {
  const datePart = new Date().toISOString().slice(0, 10);
  return `team_trends_${datePart}_${safeFilenamePart("club")}.pdf`;
}

/** Export team trends (raster capture, portrait). */
export async function downloadTeamTrendsReportPdf(element: HTMLElement): Promise<void> {
  await downloadElementAsPdf(element, teamTrendsReportPdfFilename(), {
    orientation: "portrait",
    splitByTopLevelSections: false,
  });
}
