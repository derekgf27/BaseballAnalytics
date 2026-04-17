import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { CoachPacketModel } from "./coachPacketTypes";

function coachPacketFilenameBase(m: CoachPacketModel): string {
  const d = m.game.date.replace(/[^\d-]/g, "").slice(0, 10);
  const safe = (s: string) =>
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "game";
  return `coach-packet_${d}_${safe(m.game.away_team)}_at_${safe(m.game.home_team)}`;
}

function nextStartY(doc: jsPDF, margin: number): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (last?.finalY ?? margin) + 10;
}

export function downloadCoachPacketPdf(m: CoachPacketModel): void {
  const filenameBase = coachPacketFilenameBase(m);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 14;
  let y = margin;

  const title = `${formatDateMMDDYYYY(m.game.date)} — ${m.game.away_team} @ ${m.game.home_team}`;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const scoreLine =
    m.game.final_score_home != null && m.game.final_score_away != null
      ? `Score: ${m.game.final_score_away}-${m.game.final_score_home} (away-home)`
      : "Score: not finalized";
  doc.text(scoreLine, margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Lineup — ${m.our_team_name}`, margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Slot", "Name", "Pos", "#", "Bats"]],
    body: m.our_lineup.map((r) => [r.slot, r.name, r.position || "—", r.jersey || "—", r.bats || "—"]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    theme: "striped",
  });

  y = nextStartY(doc, margin);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Lineup — ${m.opponent_team_name}`, margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Slot", "Name", "Pos", "#", "Bats"]],
    body: m.opponent_lineup.map((r) => [r.slot, r.name, r.position || "—", r.jersey || "—", r.bats || "—"]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    theme: "striped",
  });

  y = nextStartY(doc, margin);
  if (y > 240) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Plate appearances", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        "Inn",
        "½",
        "O",
        "Bases",
        "Cnt",
        "Batter",
        "Bt",
        "Pitcher",
        "Thr",
        "Result",
        "RBI",
        "#P",
      ],
    ],
    body: m.plate_appearances.map((p) => [
      p.inning,
      p.inning_half,
      p.outs,
      p.base_state,
      `${p.count_balls}-${p.count_strikes}`,
      p.batter,
      p.batter_bats || "—",
      p.pitcher || "—",
      p.pitcher_throws || "—",
      p.result,
      p.rbi,
      p.pitches_seen || "—",
    ]),
    styles: { fontSize: 6.5, cellPadding: 0.8 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    theme: "striped",
    showHead: "everyPage",
  });

  doc.save(`${filenameBase}.pdf`);
}
