import { jsPDF } from "jspdf";
import { formatDateMMDDYYYY } from "@/lib/format";
import { ourVenueLabel } from "@/lib/opponentUtils";
import type { CoachPacketModel } from "./coachPacketTypes";

function coachPacketFilenameBase(m: CoachPacketModel): string {
  const d = m.game.date.replace(/[^\d-]/g, "").slice(0, 10);
  const safe = (s: string) =>
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "game";
  return `coach-packet_${d}_${safe(m.our_team_name)}_vs_${safe(m.opponent_team_name)}_${m.game.our_side}`;
}

function statFmt(n: number | null): string {
  return n != null && Number.isFinite(n) ? n.toFixed(3) : "—";
}

function drawLineupColumn(
  doc: jsPDF,
  rows: CoachPacketModel["our_lineup"],
  x: number,
  startY: number,
  width: number
): void {
  let y = startY;
  for (const r of rows) {
    if (y > 258) break;
    const slot = `${r.slot}.`;
    const name = r.name || "Unknown";
    const meta = [r.jersey ? `#${r.jersey}` : null, r.position || null].filter(Boolean).join(" · ") || "—";
    const stats = `AVG ${statFmt(r.avg)}   OPS ${statFmt(r.ops)}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(slot, x, y);
    doc.text(name, x + 8, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(stats, x + width - 2, y, { align: "right" });

    y += 4.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(meta, x + 8, y);
    doc.setTextColor(20, 20, 20);
    y += 5.4;
  }
}

export function downloadCoachPacketPdf(m: CoachPacketModel): void {
  const filenameBase = coachPacketFilenameBase(m);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 12;

  const title = `${m.our_team_name} vs ${m.opponent_team_name}`;
  const subtitle = `${formatDateMMDDYYYY(m.game.date)} · ${ourVenueLabel(m.game)} · Season AVG/OPS`;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, margin, margin + 10);

  const yTop = margin + 20;
  const pageW = doc.internal.pageSize.getWidth();
  const colGap = 8;
  const colW = (pageW - margin * 2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;

  doc.setDrawColor(190, 190, 190);
  doc.line(margin, yTop - 4, pageW - margin, yTop - 4);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(m.our_team_name, leftX, yTop);
  doc.text(m.opponent_team_name, rightX, yTop);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("AVG / OPS are season totals from logged PAs", leftX, yTop + 4.8);
  doc.text("AVG / OPS are season totals from logged PAs", rightX, yTop + 4.8);
  doc.setTextColor(20, 20, 20);

  drawLineupColumn(doc, m.our_lineup, leftX, yTop + 11, colW);
  drawLineupColumn(doc, m.opponent_lineup, rightX, yTop + 11, colW);

  doc.save(`${filenameBase}.pdf`);
}
