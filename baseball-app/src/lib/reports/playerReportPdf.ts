import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { HitterProfileReportSection } from "@/lib/reports/hitterProfileReportTables";
import { deliverJsPdf } from "@/lib/reports/pdfDelivery";
import type { HitterReportBundle } from "./playerReportTypes";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { BattingStats, BattingStatsWithSplits } from "@/lib/types";

const MARGIN = 12;

const PDF_COLORS = {
  bodyText: [0, 0, 0] as [number, number, number],
  headFill: [55, 55, 55] as [number, number, number],
  headText: 255,
} as const;

/** Sections that start on a new page in the single-player profile PDF. */
const SINGLE_PROFILE_PAGE_BREAK_TITLES = new Set([
  "Discipline & BIP",
  "Discipline & BIP by count state",
]);

type PdfTypography = {
  allowNewPage: boolean;
  /** When true, {@link SINGLE_PROFILE_PAGE_BREAK_TITLES} force `addPage` before the section. */
  explicitSectionPageBreaks: boolean;
  tableCellPad: number;
  tableHeadExtra: number;
  sectionTitle: number;
  sectionSubtitle: number;
  sectionAfterTable: number;
  tableTailGap: number;
  playerNameLine: number;
  docTitleLine: number;
  docSubtitle: number;
  playerHeader: number;
  sprayBody: number;
  sprayHead: number;
  legacySplitBody: number;
  tableBody: (colCount: number) => number;
};

const TYPO_DEFAULT: PdfTypography = {
  allowNewPage: true,
  explicitSectionPageBreaks: false,
  tableCellPad: 1.2,
  tableHeadExtra: 1,
  sectionTitle: 12,
  sectionSubtitle: 8,
  sectionAfterTable: 3,
  tableTailGap: 6,
  playerNameLine: 14,
  docTitleLine: 16,
  docSubtitle: 10,
  playerHeader: 14,
  sprayBody: 9,
  sprayHead: 10,
  legacySplitBody: 9,
  tableBody: (colCount) =>
    colCount > 18 ? 7 : colCount > 14 ? 7.5 : colCount > 10 ? 8 : 9,
};

/** Single-player full profile: larger type, one landscape page, no page breaks. */
const TYPO_SINGLE_PAGE: PdfTypography = {
  allowNewPage: false,
  explicitSectionPageBreaks: true,
  tableCellPad: 1.65,
  tableHeadExtra: 1,
  sectionTitle: 14,
  sectionSubtitle: 9.5,
  sectionAfterTable: 2,
  tableTailGap: 5,
  playerNameLine: 20,
  docTitleLine: 16,
  docSubtitle: 10,
  playerHeader: 14,
  sprayBody: 10.5,
  sprayHead: 11.5,
  legacySplitBody: 10,
  tableBody: (colCount) =>
    colCount > 18 ? 8.5 : colCount > 14 ? 9 : colCount > 10 ? 9.5 : 10.5,
};

const REPORT_TITLE = "Hitter Profile Report";

let activeTypo: PdfTypography = TYPO_DEFAULT;

function tableBodyStyles(fontSize: number) {
  return {
    fontSize,
    cellPadding: activeTypo.tableCellPad,
    textColor: PDF_COLORS.bodyText,
    overflow: "linebreak" as const,
  };
}

function tableHeadStyles(fontSize: number) {
  return {
    fillColor: PDF_COLORS.headFill,
    textColor: PDF_COLORS.headText,
    fontSize,
  };
}

function setBodyTextColor(doc: jsPDF): void {
  doc.setTextColor(PDF_COLORS.bodyText[0], PDF_COLORS.bodyText[1], PDF_COLORS.bodyText[2]);
}

const PDF_FONT_COMPARE = {
  compareTitle: 16,
  compareSubtitle: 10,
  compareTable: 8.5,
  tableHeadExtra: 1,
  tableCellPad: 1.2,
} as const;

function playerDisplayName(p: HitterReportBundle["players"][number]): string {
  return `${p.name}${p.jersey ? ` #${p.jersey}` : ""} (${p.bats ?? "?"})`;
}

function nextStartY(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (last?.finalY ?? MARGIN) + activeTypo.tableTailGap;
}

function pageBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - 14;
}

function ensureSpace(doc: jsPDF, y: number, reserve = 36): number {
  if (!activeTypo.allowNewPage) return y;
  if (y > pageBottom(doc) - reserve) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function safeFilenamePart(s: string): string {
  return s
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 28) || "player";
}

function fmt3(n: number): string {
  return Number.isFinite(n) ? fmtDecimalNoLeadingZero(n, 3) : "—";
}

function battingSplitRows(stats: BattingStatsWithSplits | null | undefined): (string | number)[][] {
  if (!stats) return [["(no batting sample)", "", "", "", "", "", "", ""]];
  const rows: (string | number)[][] = [];
  const add = (label: string, s: BattingStats | null) => {
    if (!s || (s.pa ?? 0) === 0) {
      rows.push([label, 0, 0, 0, "—", "—", "—", "—"]);
      return;
    }
    rows.push([
      label,
      s.pa ?? 0,
      s.ab ?? 0,
      s.h ?? 0,
      fmt3(s.avg),
      fmt3(s.obp),
      fmt3(s.slg),
      fmt3(s.ops),
    ]);
  };
  add("Overall", stats.overall);
  add("vs LHP", stats.vsL);
  add("vs RHP", stats.vsR);
  add("RISP", stats.risp);
  return rows;
}

function dirCounts(data: { hit_direction: string }[]): { pull: number; mid: number; oppo: number } {
  let pull = 0;
  let mid = 0;
  let oppo = 0;
  for (const d of data) {
    if (d.hit_direction === "pulled") pull++;
    else if (d.hit_direction === "up_the_middle") mid++;
    else if (d.hit_direction === "opposite_field") oppo++;
  }
  return { pull, mid, oppo };
}

/** Direction cell: share of BIP plus raw count, e.g. `50% (2)`. */
function pctWithCount(n: number, total: number): string {
  if (total <= 0) return n > 0 ? `— (${n})` : "—";
  return `${Math.round((100 * n) / total)}% (${n})`;
}

function sprayMergedRows(spray: AnalystPlayerSpraySplits | null): (string | number)[][] {
  if (!spray) return [["(no spray data)", "", "", "", ""]];

  const addRow = (label: string, data: { hit_direction: string }[]): (string | number)[] => {
    const { pull, mid, oppo } = dirCounts(data);
    const bip = pull + mid + oppo;
    return [label, bip, pctWithCount(pull, bip), pctWithCount(mid, bip), pctWithCount(oppo, bip)];
  };

  if (spray.mode === "batting") {
    const rows: (string | number)[][] = [];
    if (spray.vsL) rows.push(addRow("vs LHP", spray.vsL.data));
    else rows.push(["vs LHP", "—", "—", "—", "—"]);
    if (spray.vsR) rows.push(addRow("vs RHP", spray.vsR.data));
    else rows.push(["vs RHP", "—", "—", "—", "—"]);
    return rows.length > 0 ? rows : [["(no spray data)", "", "", "", ""]];
  }

  return [addRow("vs LHB", spray.vsL.data), addRow("vs RHB", spray.vsR.data)];
}

function sectionStartsNewPage(section: HitterProfileReportSection): boolean {
  return (
    activeTypo.explicitSectionPageBreaks && SINGLE_PROFILE_PAGE_BREAK_TITLES.has(section.title)
  );
}

function drawProfileSection(doc: jsPDF, section: HitterProfileReportSection, startY: number): number {
  let y = startY;
  setBodyTextColor(doc);
  doc.setFontSize(activeTypo.sectionTitle);
  doc.setFont("helvetica", "bold");
  doc.text(section.title, MARGIN, y);
  y += activeTypo.allowNewPage ? 5.5 : 6;

  const head = section.rowLabelHeader
    ? [section.rowLabelHeader, ...section.columnLabels]
    : section.columnLabels;
  const colCount = head.length;
  const fontSize = activeTypo.tableBody(colCount);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [head],
    body: section.rows,
    styles: tableBodyStyles(fontSize),
    headStyles: tableHeadStyles(fontSize + activeTypo.tableHeadExtra),
    alternateRowStyles: { textColor: PDF_COLORS.bodyText },
    theme: "striped",
  });
  return nextStartY(doc);
}

function drawSplitsTable(
  doc: jsPDF,
  title: string,
  stats: BattingStatsWithSplits | null | undefined,
  startY: number
): number {
  setBodyTextColor(doc);
  doc.setFontSize(activeTypo.sectionTitle);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, startY);
  const splitFont = activeTypo.legacySplitBody;
  autoTable(doc, {
    startY: startY + 5,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Split", "PA", "AB", "H", "AVG", "OBP", "SLG", "OPS"]],
    body: battingSplitRows(stats),
    styles: tableBodyStyles(splitFont),
    headStyles: tableHeadStyles(splitFont + activeTypo.tableHeadExtra),
    alternateRowStyles: { textColor: PDF_COLORS.bodyText },
    theme: "striped",
  });
  return nextStartY(doc);
}

function drawSprayTables(
  doc: jsPDF,
  spray: AnalystPlayerSpraySplits | null,
  startY: number,
  heading = "Spray / BIP direction (logged balls in play)"
): number {
  setBodyTextColor(doc);
  doc.setFontSize(activeTypo.sectionTitle);
  doc.setFont("helvetica", "bold");
  doc.text(heading, MARGIN, startY);
  autoTable(doc, {
    startY: startY + 2,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Sample", "BIP", "Pull", "Mid", "Oppo"]],
    body: sprayMergedRows(spray),
    styles: tableBodyStyles(activeTypo.sprayBody),
    headStyles: tableHeadStyles(activeTypo.sprayHead),
    alternateRowStyles: { textColor: PDF_COLORS.bodyText },
    theme: "striped",
  });
  return nextStartY(doc);
}

function drawFullPlayerProfile(doc: jsPDF, bundle: HitterReportBundle, playerId: string, startY: number): number {
  const payload = bundle.profile?.[playerId];
  let y = startY;

  if (payload?.sections?.length) {
    for (const section of payload.sections) {
      if (sectionStartsNewPage(section)) {
        doc.addPage();
        y = MARGIN;
      } else {
        y = ensureSpace(doc, y, 42);
      }
      y = drawProfileSection(doc, section, y) + activeTypo.sectionAfterTable;
    }
  } else {
    y = drawSplitsTable(doc, "Batting splits", bundle.batting[playerId], y);
  }

  y = ensureSpace(doc, y, 45);
  const p = bundle.players.find((x) => x.id === playerId);
  const sprayHeading = p ? `Spray — ${p.name}` : "Spray / BIP direction";
  y = drawSprayTables(doc, bundle.spray[playerId] ?? null, y + 2, sprayHeading);
  return y + 4;
}

function drawCompareSplits(doc: jsPDF, bundle: HitterReportBundle): void {
  const [a, b] = bundle.players;
  const sa = bundle.batting[a.id];
  const sb = bundle.batting[b.id];

  const splits: { label: string; la: BattingStats | null; lb: BattingStats | null }[] = [
    { label: "Overall", la: sa?.overall ?? null, lb: sb?.overall ?? null },
    { label: "vs LHP", la: sa?.vsL ?? null, lb: sb?.vsL ?? null },
    { label: "vs RHP", la: sa?.vsR ?? null, lb: sb?.vsR ?? null },
    { label: "RISP", la: sa?.risp ?? null, lb: sb?.risp ?? null },
  ];

  const body = splits.map(({ label, la, lb }) => [
    label,
    la && (la.pa ?? 0) > 0 ? la.pa ?? 0 : "—",
    la && (la.pa ?? 0) > 0 ? fmt3(la.avg) : "—",
    la && (la.pa ?? 0) > 0 ? fmt3(la.ops) : "—",
    lb && (lb.pa ?? 0) > 0 ? lb.pa ?? 0 : "—",
    lb && (lb.pa ?? 0) > 0 ? fmt3(lb.avg) : "—",
    lb && (lb.pa ?? 0) > 0 ? fmt3(lb.ops) : "—",
  ]);

  activeTypo = TYPO_DEFAULT;
  setBodyTextColor(doc);
  doc.setFontSize(PDF_FONT_COMPARE.compareTitle);
  doc.setFont("helvetica", "bold");
  doc.text(`Comparison: ${a.name} vs ${b.name}`, MARGIN, MARGIN + 4);
  doc.setFontSize(PDF_FONT_COMPARE.compareSubtitle);
  doc.setFont("helvetica", "italic");
  setBodyTextColor(doc);
  doc.text(`${a.bats ?? "?"} vs ${b.bats ?? "?"} · Splits summary`, MARGIN, MARGIN + 11);

  const compareFont = PDF_FONT_COMPARE.compareTable;
  autoTable(doc, {
    startY: MARGIN + 15,
    margin: { left: MARGIN, right: MARGIN },
    head: [
      [
        "Split",
        `${a.name.slice(0, 18)} PA`,
        "AVG",
        "OPS",
        `${b.name.slice(0, 18)} PA`,
        "AVG",
        "OPS",
      ],
    ],
    body,
    styles: {
      ...tableBodyStyles(compareFont),
      cellPadding: PDF_FONT_COMPARE.tableCellPad,
    },
    headStyles: tableHeadStyles(compareFont + PDF_FONT_COMPARE.tableHeadExtra),
    alternateRowStyles: { textColor: PDF_COLORS.bodyText },
    theme: "striped",
  });

  let y = nextStartY(doc) + 6;
  y = ensureSpace(doc, y, 50);
  y = drawSprayTables(doc, bundle.spray[a.id] ?? null, y, `Spray — ${a.name}`);

  y = ensureSpace(doc, y + 8, 50);
  drawSprayTables(doc, bundle.spray[b.id] ?? null, y, `Spray — ${b.name}`);
}

function drawMultiProfile(doc: jsPDF, bundle: HitterReportBundle): void {
  const fullProfile = bundle.profile != null && Object.values(bundle.profile).some((p) => (p?.sections.length ?? 0) > 0);
  const singlePlayer = bundle.players.length === 1;
  const singleFullPage = singlePlayer && fullProfile;
  const pageW = doc.internal.pageSize.getWidth();

  activeTypo = singleFullPage ? TYPO_SINGLE_PAGE : TYPO_DEFAULT;
  setBodyTextColor(doc);

  let y: number;
  if (singleFullPage) {
    const p = bundle.players[0]!;
    const headerY = MARGIN + 9;
    doc.setFontSize(activeTypo.playerNameLine);
    doc.setFont("helvetica", "bold");
    doc.text(playerDisplayName(p), MARGIN, headerY);
    doc.setFontSize(activeTypo.docTitleLine);
    doc.text(REPORT_TITLE, pageW - MARGIN, headerY, { align: "right" });
    y = headerY + 8;
    y = drawFullPlayerProfile(doc, bundle, p.id, y);
    return;
  }

  doc.setFontSize(activeTypo.docTitleLine);
  doc.setFont("helvetica", "bold");
  const title = fullProfile ? REPORT_TITLE : "Hitter / pitcher spray report";
  doc.text(title, MARGIN, MARGIN + 5);

  y = MARGIN + 12;
  if (!singlePlayer) {
    doc.setFontSize(activeTypo.docSubtitle);
    doc.setFont("helvetica", "normal");
    setBodyTextColor(doc);
    const names = bundle.players.map((p) => p.name).join(", ");
    doc.text(names.length > 90 ? `${bundle.players.length} players` : names, MARGIN, MARGIN + 12);
    y = MARGIN + 18;
  }

  for (let i = 0; i < bundle.players.length; i++) {
    const p = bundle.players[i];
    y = ensureSpace(doc, y, 24);
    if (i > 0) {
      doc.addPage();
      y = MARGIN;
    }
    setBodyTextColor(doc);
    doc.setFontSize(activeTypo.playerHeader);
    doc.setFont("helvetica", "bold");
    doc.text(playerDisplayName(p), MARGIN, y);
    y += 6;
    y = drawFullPlayerProfile(doc, bundle, p.id, y);
  }
}

export async function downloadHitterReportPdf(
  bundle: HitterReportBundle,
  options: { compare: boolean }
): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const fullProfile =
    !options.compare &&
    bundle.profile != null &&
    Object.values(bundle.profile).some((p) => (p?.sections.length ?? 0) > 0);

  const doc = new JsPDF({
    orientation: fullProfile ? "landscape" : "portrait",
    unit: "mm",
    format: "letter",
  });

  if (options.compare && bundle.players.length === 2) {
    drawCompareSplits(doc, bundle);
  } else {
    drawMultiProfile(doc, bundle);
  }

  const base =
    bundle.players.length === 1
      ? `hitter-report_${safeFilenamePart(bundle.players[0].name)}`
      : bundle.players.length === 2 && options.compare
        ? `compare_${safeFilenamePart(bundle.players[0].name)}_${safeFilenamePart(bundle.players[1].name)}`
        : `hitter-report_${bundle.players.length}-players`;
  deliverJsPdf(doc, `${base}.pdf`);
}
