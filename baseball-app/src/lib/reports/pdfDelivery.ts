import type { jsPDF } from "jspdf";

/** Save to disk and open the PDF in a new browser tab (same flow as player profile export). */
export function deliverJsPdf(doc: jsPDF, filename: string): void {
  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const blob = doc.output("blob");
  try {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    /* preview tab optional; download still runs */
  }
  doc.save(name);
}
