import { downloadElementAsPdf } from "@/lib/reports/htmlElementPdf";

function safeFilenamePart(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48) || "charts"
  );
}

export function chartsReportPdfFilename(filterLabel?: string, scope: "full" | "snapshot" = "full"): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const filterBit = filterLabel ? `_${safeFilenamePart(filterLabel)}` : "";
  const scopeBit = scope === "snapshot" ? "_snapshot" : "";
  return `charts_${datePart}${scopeBit}${filterBit}.pdf`;
}

/** Export analyst charts page (single continuous capture, sliced at page height). */
export async function downloadChartsReportPdf(
  element: HTMLElement,
  filterLabel?: string,
  scope: "full" | "snapshot" = "full"
): Promise<void> {
  await downloadElementAsPdf(element, chartsReportPdfFilename(filterLabel, scope), {
    orientation: "landscape",
    splitByTopLevelSections: false,
  });
}
