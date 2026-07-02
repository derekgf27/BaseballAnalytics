import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  boxScoreInningColumnCount,
  countHitsBottom,
  countHitsTop,
  paCountsAsDefensiveErrorForLinescore,
  sumRunsBottomInning,
  sumRunsTopInning,
  totalErrorsChargedToAway,
  totalErrorsChargedToHome,
  totalRunsBottom,
  totalRunsTop,
} from "@/lib/compute/boxScore";
import { paErrorFielderIds } from "@/lib/record/recordPaFielding";
import {
  computeGamePitchingBox,
  plateAppearancesForPitchingSide,
  pitchingDefenseSide,
} from "@/lib/compute/gamePitchingBox";
import { computeGameBatting, type GameBattingRow } from "@/components/analyst/GameBattingTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import { ourVenueLabel } from "@/lib/opponentUtils";
import { deliverJsPdf } from "@/lib/reports/pdfDelivery";
import { sanitizeGameReviewPdfFilename } from "@/lib/gameReviewPdfInsights";
import type { Game, PlateAppearance, Player } from "@/lib/types";

const MARGIN = 10;
const COL_GAP = 5;
/** Space to the right of the linescore for W / L / SV pitcher lines. */
const PITCHER_PANEL_W = 58;
const LINESCORE_PANEL_GAP = 4;

/** Between the original compact PDF and the oversized pass — keeps legibility without clipping footers. */
const PDF_TYPO = {
  title: 15,
  meta: 9.5,
  sectionTitle: 10.5,
  sectionBarH: 7,
  tableHead: 8.5,
  tableBody: 8,
  tableCellPad: 1.5,
  tableHeadCellPad: 1.7,
  footer: 7.5,
  teamLabel: 8,
  pitcherPanel: 8.5,
  pitcherLabelIndent: 13,
} as const;

const PDF_COLORS = {
  bodyText: [15, 23, 42] as [number, number, number],
  headFill: [30, 41, 59] as [number, number, number],
  headText: 255,
  sectionFill: [241, 245, 249] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
} as const;

export type BoxScorePdfInput = {
  game: Game;
  pasAll: PlateAppearance[];
  pasAway: PlateAppearance[];
  pasHome: PlateAppearance[];
  players: Player[];
  awayLineupOrder?: string[];
  homeLineupOrder?: string[];
  awayLineupPositionByPlayerId?: Record<string, string>;
  homeLineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
};

function teamAbbrev(name: string): string {
  const skip = new Set(["de", "del", "la", "las", "los", "el", "y"]);
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));
  if (words.length >= 2) {
    return words
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 4);
  }
  return name.replace(/\s+/g, "").slice(0, 4).toUpperCase();
}

function dashOrNum(n: number): string {
  return n > 0 ? String(n) : "—";
}

function battingPlayerLabel(row: GameBattingRow, player?: Player): string {
  const jersey = player?.jersey != null ? ` #${player.jersey}` : "";
  if (row.isSubstitution) {
    if (jersey) return `PH ${row.name}${jersey}`;
    return row.position ? `PH ${row.name} ${row.position}` : `PH ${row.name}`;
  }
  return row.position ? `${row.name} (${row.position})` : row.name;
}

function battingFooterLines(rows: GameBattingRow[]): string[] {
  const sum = (pick: (r: GameBattingRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const doubles = sum((r) => r.double);
  const triples = sum((r) => r.triple);
  const tb = sum((r) => r.tb);
  const cs = sum((r) => r.cs);
  const hbp = sum((r) => r.hbp);
  const sb = sum((r) => r.sb);
  const lob = sum((r) => r.lob);
  const twoBLine =
    triples > 0 && doubles > 0
      ? `2B: ${doubles}, 3B: ${triples}`
      : doubles > 0
        ? `2B: ${doubles}`
        : triples > 0
          ? `3B: ${triples}`
          : "2B: —";
  return [
    twoBLine,
    `TB: ${tb > 0 ? tb : "—"}`,
    `CS: ${dashOrNum(cs)}`,
    `HBP: ${dashOrNum(hbp)}`,
    `SB: ${dashOrNum(sb)}`,
    `LOB: ${lob > 0 ? lob : "—"}`,
  ];
}

function pitcherPitchStrikeLine(
  pas: PlateAppearance[],
  pitcherId: string,
  name: string
): string | null {
  const pitcherPas = pas.filter((p) => p.pitcher_id === pitcherId);
  if (pitcherPas.length === 0) return null;
  let pitches = 0;
  let strikes = 0;
  let hasPitchData = false;
  for (const pa of pitcherPas) {
    if (typeof pa.pitches_seen === "number") {
      pitches += pa.pitches_seen;
      hasPitchData = true;
    }
    if (typeof pa.strikes_thrown === "number") {
      strikes += pa.strikes_thrown;
    }
  }
  if (!hasPitchData) return null;
  return `${name} ${pitches}-${strikes}`;
}

function pitchingFooterLines(
  pasAll: PlateAppearance[],
  side: "away" | "home",
  rows: { playerId: string; name: string }[],
  playerById: Map<string, Player>
): string[] {
  const defensePas = plateAppearancesForPitchingSide(pasAll, side);
  const psLines = rows
    .map((r) => pitcherPitchStrikeLine(defensePas, r.playerId, r.name))
    .filter((x): x is string => x != null);
  const hbp = defensePas.filter((p) => p.result === "hbp").length;
  const bfByPitcher = rows.map((r) => {
    const n = defensePas.filter((p) => p.pitcher_id === r.playerId).length;
    return n > 0 ? `${r.name} ${n}` : null;
  }).filter((x): x is string => x != null);

  const errorCounts = new Map<string, number>();
  for (const pa of pasAll) {
    if (pitchingDefenseSide(pa) !== side) continue;
    if (!paCountsAsDefensiveErrorForLinescore(pa)) continue;
    for (const fid of paErrorFielderIds(pa)) {
      errorCounts.set(fid, (errorCounts.get(fid) ?? 0) + 1);
    }
  }
  const eLine =
    errorCounts.size === 0
      ? "—"
      : [...errorCounts.entries()]
          .map(([id, n]) => {
            const name = playerById.get(id)?.name ?? "?";
            return `${name} (${n})`;
          })
          .join(", ");

  return [
    psLines.length > 0 ? `P-S: ${psLines.join("; ")}` : "P-S: —",
    "WP: —",
    `HBP: ${hbp > 0 ? hbp : "—"}`,
    bfByPitcher.length > 0 ? `BF: ${bfByPitcher.join("; ")}` : "BF: —",
    `E: ${eLine}`,
  ];
}

function tableHeadStyles(fontSize: number) {
  return {
    fillColor: PDF_COLORS.headFill,
    textColor: PDF_COLORS.headText,
    fontSize,
    fontStyle: "bold" as const,
    halign: "center" as const,
  };
}

function tableBodyStyles(fontSize: number, cellPadding = PDF_TYPO.tableCellPad) {
  return {
    fontSize,
    cellPadding,
    textColor: PDF_COLORS.bodyText,
    overflow: "linebreak" as const,
  };
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, pageW: number): number {
  const barH = PDF_TYPO.sectionBarH;
  doc.setFillColor(...PDF_COLORS.sectionFill);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, barH, "F");
  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  doc.line(MARGIN, y + barH, pageW - MARGIN, y + barH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.sectionTitle);
  doc.setTextColor(...PDF_COLORS.bodyText);
  doc.text(title, pageW / 2, y + barH * 0.62, { align: "center" });
  return y + barH + 3;
}

function pitcherCreditName(
  id: string | null | undefined,
  playerById: Map<string, Player>
): string {
  const key = id?.trim();
  if (!key) return "—";
  return playerById.get(key)?.name ?? "—";
}

/** W / L / SV block beside the compact linescore. */
function drawPitcherDecisionsPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  game: Game,
  playerById: Map<string, Player>
): number {
  const entries = [
    { label: "Win", name: pitcherCreditName(game.winning_pitcher_id, playerById) },
    { label: "Loss", name: pitcherCreditName(game.losing_pitcher_id, playerById) },
    { label: "Save", name: pitcherCreditName(game.save_pitcher_id, playerById) },
  ];

  doc.setTextColor(...PDF_COLORS.bodyText);
  let cy = y + 6;
  for (const { label, name } of entries) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TYPO.pitcherPanel);
    doc.text(`${label}:`, x, cy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_TYPO.pitcherPanel);
    const wrapped = doc.splitTextToSize(name, width - PDF_TYPO.pitcherLabelIndent);
    doc.text(wrapped, x + PDF_TYPO.pitcherLabelIndent, cy);
    cy += Math.max(wrapped.length * 3.8, 5);
  }
  return cy;
}

function linescoreColumnStyles(
  inningCount: number,
  tableWidth: number
): Record<number, { cellWidth: number; halign?: "left" | "center"; fontStyle?: "bold" }> {
  const teamColW = 14;
  const rheColW = 10;
  const fixedW = teamColW + 3 * rheColW;
  const inningColW =
    inningCount > 0 ? Math.max(5.5, (tableWidth - fixedW) / inningCount) : 6.5;

  const styles: Record<number, { cellWidth: number; halign?: "left" | "center"; fontStyle?: "bold" }> = {
    0: { cellWidth: teamColW, halign: "left", fontStyle: "bold" },
  };
  const rheStart = inningCount + 1;
  for (let i = 1; i <= inningCount; i += 1) {
    styles[i] = { cellWidth: inningColW, halign: "center" };
  }
  for (let i = rheStart; i <= rheStart + 2; i += 1) {
    styles[i] = { cellWidth: rheColW, halign: "center", fontStyle: "bold" };
  }
  return styles;
}

function drawFooterBlock(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  lines: string[]
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.footer);
  doc.setTextColor(...PDF_COLORS.bodyText);
  let cy = y;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, width);
    doc.text(wrapped, x, cy);
    cy += wrapped.length * 3.5;
  }
  return cy;
}

export async function downloadClassicBoxScorePdf(input: BoxScorePdfInput): Promise<void> {
  const {
    game,
    pasAll,
    pasAway,
    pasHome,
    players,
    awayLineupOrder,
    homeLineupOrder,
    awayLineupPositionByPlayerId,
    homeLineupPositionByPlayerId,
    baserunningByPlayerId,
  } = input;

  const { jsPDF: JsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const colW = (pageW - MARGIN * 2 - COL_GAP) / 2;
  const playerById = new Map(players.map((p) => [p.id, p]));

  const awayR =
    typeof game.final_score_away === "number" ? game.final_score_away : totalRunsTop(pasAll);
  const homeR =
    typeof game.final_score_home === "number" ? game.final_score_home : totalRunsBottom(pasAll);

  const title = `${game.away_team} ${awayR} - ${homeR} ${game.home_team}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.title);
  doc.setTextColor(...PDF_COLORS.bodyText);
  doc.text(title, pageW / 2, 15, { align: "center", maxWidth: pageW - MARGIN * 2 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.meta);
  doc.text(`${ourVenueLabel(game)} · ${formatDateMMDDYYYY(game.date)}`, MARGIN, 22);

  const inningCount = boxScoreInningColumnCount(pasAll, 0);
  const innings = Array.from({ length: inningCount }, (_, i) => i + 1);
  const awayAbbr = teamAbbrev(game.away_team);
  const homeAbbr = teamAbbrev(game.home_team);

  const linescoreHead = ["", ...innings.map(String), "R", "H", "E"];
  const awayLine = [
    awayAbbr,
    ...innings.map((i) => String(sumRunsTopInning(pasAll, i))),
    String(awayR),
    String(countHitsTop(pasAll)),
    String(totalErrorsChargedToAway(pasAll)),
  ];
  const homeLine = [
    homeAbbr,
    ...innings.map((i) => String(sumRunsBottomInning(pasAll, i))),
    String(homeR),
    String(countHitsBottom(pasAll)),
    String(totalErrorsChargedToHome(pasAll)),
  ];

  const contentW = pageW - MARGIN * 2;
  const linescoreTableW = contentW - PITCHER_PANEL_W - LINESCORE_PANEL_GAP;
  const linescoreStartY = 26;
  const pitcherPanelX = pageW - MARGIN - PITCHER_PANEL_W;

  autoTable(doc, {
    startY: linescoreStartY,
    margin: { left: MARGIN, right: pageW - MARGIN - linescoreTableW },
    tableWidth: linescoreTableW,
    theme: "grid",
    head: [linescoreHead],
    body: [awayLine, homeLine],
    styles: {
      ...tableBodyStyles(PDF_TYPO.tableBody),
      halign: "center",
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { ...tableHeadStyles(PDF_TYPO.tableHead), cellPadding: PDF_TYPO.tableHeadCellPad },
    columnStyles: linescoreColumnStyles(inningCount, linescoreTableW),
    didParseCell(data) {
      const col = data.column.index;
      const rheStart = innings.length + 1;
      if (col >= rheStart) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const linescoreEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? linescoreStartY + 14;
  const pitcherPanelEndY = drawPitcherDecisionsPanel(
    doc,
    pitcherPanelX,
    linescoreStartY,
    PITCHER_PANEL_W,
    game,
    playerById
  );

  let y = Math.max(linescoreEndY, pitcherPanelEndY) + 5;

  const awayBatRows = computeGameBatting(
    pasAway,
    players,
    awayLineupOrder,
    awayLineupPositionByPlayerId,
    baserunningByPlayerId
  );
  const homeBatRows = computeGameBatting(
    pasHome,
    players,
    homeLineupOrder,
    homeLineupPositionByPlayerId,
    baserunningByPlayerId
  );

  const battingHead = ["", "AB", "R", "H", "RBI", "BB", "SO"];
  const battingBody = (rows: GameBattingRow[]) => {
    const body = rows.map((r) => [
      battingPlayerLabel(r, playerById.get(r.playerId)),
      String(r.ab),
      String(r.r),
      String(r.h),
      String(r.rbi),
      String(r.bb),
      String(r.k),
    ]);
    const t = rows.reduce(
      (acc, r) => ({
        ab: acc.ab + r.ab,
        r: acc.r + r.r,
        h: acc.h + r.h,
        rbi: acc.rbi + r.rbi,
        bb: acc.bb + r.bb,
        k: acc.k + r.k,
      }),
      { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 }
    );
    body.push([
      "Totals",
      String(t.ab),
      String(t.r),
      String(t.h),
      String(t.rbi),
      String(t.bb),
      String(t.k),
    ]);
    return body;
  };

  y = drawSectionTitle(doc, y, "BATTING", pageW);

  const batStartY = y;
  autoTable(doc, {
    startY: batStartY,
    margin: { left: MARGIN, bottom: MARGIN },
    tableWidth: colW,
    theme: "grid",
    head: [battingHead],
    body: battingBody(awayBatRows),
    styles: {
      ...tableBodyStyles(PDF_TYPO.tableBody),
      halign: "center",
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { ...tableHeadStyles(PDF_TYPO.tableHead), cellPadding: PDF_TYPO.tableHeadCellPad },
    columnStyles: {
      0: { halign: "left", cellWidth: colW * 0.42 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === data.table.body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = PDF_COLORS.sectionFill;
      }
    },
  });
  const awayBatEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? batStartY;

  autoTable(doc, {
    startY: batStartY,
    margin: { left: MARGIN + colW + COL_GAP, bottom: MARGIN },
    tableWidth: colW,
    theme: "grid",
    head: [battingHead],
    body: battingBody(homeBatRows),
    styles: {
      ...tableBodyStyles(PDF_TYPO.tableBody),
      halign: "center",
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { ...tableHeadStyles(PDF_TYPO.tableHead), cellPadding: PDF_TYPO.tableHeadCellPad },
    columnStyles: {
      0: { halign: "left", cellWidth: colW * 0.42 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === data.table.body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = PDF_COLORS.sectionFill;
      }
    },
  });
  const homeBatEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? batStartY;

  y = Math.max(awayBatEndY, homeBatEndY) + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.teamLabel);
  doc.text(game.away_team, MARGIN, y);
  doc.text(game.home_team, MARGIN + colW + COL_GAP, y);
  y += 4;

  const awayFootEnd = drawFooterBlock(
    doc,
    MARGIN,
    y,
    colW,
    battingFooterLines(awayBatRows)
  );
  const homeFootEnd = drawFooterBlock(
    doc,
    MARGIN + colW + COL_GAP,
    y,
    colW,
    battingFooterLines(homeBatRows)
  );
  y = Math.max(awayFootEnd, homeFootEnd) + 5;

  if (y > pageH - 50) {
    doc.addPage();
    y = MARGIN;
  }

  const awayPitch = computeGamePitchingBox(pasAll, "away", playerById);
  const homePitch = computeGamePitchingBox(pasAll, "home", playerById);

  y = drawSectionTitle(doc, y, "PITCHING", pageW);

  const pitchHead = ["", "IP", "H", "R", "ER", "BB", "SO", "HR"];
  const pitchBody = (rows: typeof awayPitch.rows, totals: typeof awayPitch.totals) => {
    const body = rows.map((r) => [
      r.name,
      r.ip,
      String(r.h),
      String(r.r),
      String(r.er),
      String(r.bb),
      String(r.k),
      String(r.hr),
    ]);
    body.push([
      "Totals",
      totals.ip,
      String(totals.h),
      String(totals.r),
      String(totals.er),
      String(totals.bb),
      String(totals.k),
      String(totals.hr),
    ]);
    return body;
  };

  const pitchStartY = y;
  autoTable(doc, {
    startY: pitchStartY,
    margin: { left: MARGIN, bottom: MARGIN },
    tableWidth: colW,
    theme: "grid",
    head: [pitchHead],
    body: pitchBody(awayPitch.rows, awayPitch.totals),
    styles: {
      ...tableBodyStyles(PDF_TYPO.tableBody),
      halign: "center",
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { ...tableHeadStyles(PDF_TYPO.tableHead), cellPadding: PDF_TYPO.tableHeadCellPad },
    columnStyles: {
      0: { halign: "left", cellWidth: colW * 0.34 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === data.table.body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = PDF_COLORS.sectionFill;
      }
    },
  });
  const awayPitchEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? pitchStartY;

  autoTable(doc, {
    startY: pitchStartY,
    margin: { left: MARGIN + colW + COL_GAP, bottom: MARGIN },
    tableWidth: colW,
    theme: "grid",
    head: [pitchHead],
    body: pitchBody(homePitch.rows, homePitch.totals),
    styles: {
      ...tableBodyStyles(PDF_TYPO.tableBody),
      halign: "center",
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { ...tableHeadStyles(PDF_TYPO.tableHead), cellPadding: PDF_TYPO.tableHeadCellPad },
    columnStyles: {
      0: { halign: "left", cellWidth: colW * 0.34 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === data.table.body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = PDF_COLORS.sectionFill;
      }
    },
  });
  const homePitchEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? pitchStartY;

  y = Math.max(awayPitchEndY, homePitchEndY) + 3;
  const awayPitchFoot = pitchingFooterLines(pasAll, "away", awayPitch.rows, playerById);
  const homePitchFoot = pitchingFooterLines(pasAll, "home", homePitch.rows, playerById);
  const pitchFootLineCount = Math.max(awayPitchFoot.length, homePitchFoot.length);
  const pitchFootBlockH = 4 + PDF_TYPO.teamLabel * 0.45 + pitchFootLineCount * 3.5 + 2;
  if (y + pitchFootBlockH > pageH - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.teamLabel);
  doc.text(game.away_team, MARGIN, y);
  doc.text(game.home_team, MARGIN + colW + COL_GAP, y);
  y += 3.5;

  drawFooterBlock(doc, MARGIN, y, colW, awayPitchFoot);
  drawFooterBlock(doc, MARGIN + colW + COL_GAP, y, colW, homePitchFoot);

  const filename = `${sanitizeGameReviewPdfFilename(game)}-box-score.pdf`;
  deliverJsPdf(doc, filename);
}
