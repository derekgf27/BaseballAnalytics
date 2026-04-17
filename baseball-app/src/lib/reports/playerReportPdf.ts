import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { HitterReportBundle } from "./playerReportTypes";
import type { BattingStats, BattingStatsWithSplits } from "@/lib/types";

const MARGIN = 14;

function nextStartY(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (last?.finalY ?? MARGIN) + 8;
}

function safeFilenamePart(s: string): string {
  return s
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 28) || "player";
}

function fmt3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
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

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((100 * n) / d)}%`;
}

function sprayRows(spray: AnalystPlayerSpraySplits | null): (string | number)[][] {
  if (!spray) return [["(no spray data)", "", "", "", "", ""]];
  const rows: (string | number)[][] = [];
  if (spray.mode === "batting") {
    const addBat = (label: string, block: AnalystPlayerSpraySplits["vsL"] | null) => {
      if (!block) {
        rows.push([label, "—", "—", "—", "—", 0]);
        return;
      }
      const { pull, mid, oppo } = dirCounts(block.data);
      const t = pull + mid + oppo;
      rows.push([
        label,
        pull,
        mid,
        oppo,
        t,
        block.line.pa,
      ]);
    };
    addBat("vs LHP (BIP dir.)", spray.vsL);
    addBat("vs RHP (BIP dir.)", spray.vsR);
  } else {
    rows.push([
      "vs LHB (BIP dir.)",
      ...(() => {
        const { pull, mid, oppo } = dirCounts(spray.vsL.data);
        const t = pull + mid + oppo;
        return [pull, mid, oppo, t, spray.vsL.line.pa] as (string | number)[];
      })(),
    ]);
    rows.push([
      "vs RHB (BIP dir.)",
      ...(() => {
        const { pull, mid, oppo } = dirCounts(spray.vsR.data);
        const t = pull + mid + oppo;
        return [pull, mid, oppo, t, spray.vsR.line.pa] as (string | number)[];
      })(),
    ]);
  }
  return rows;
}

function sprayMixRows(spray: AnalystPlayerSpraySplits | null): (string | number)[][] {
  if (!spray) return [];
  const rows: (string | number)[][] = [];
  if (spray.mode === "batting") {
    for (const label of ["vs LHP", "vs RHP"] as const) {
      const block = label === "vs LHP" ? spray.vsL : spray.vsR;
      if (!block) continue;
      const { pull, mid, oppo } = dirCounts(block.data);
      const t = pull + mid + oppo;
      rows.push([
        `${label} mix`,
        pct(pull, t),
        pct(mid, t),
        pct(oppo, t),
        t,
      ]);
    }
  } else {
    for (const [label, block] of [
      ["vs LHB", spray.vsL],
      ["vs RHB", spray.vsR],
    ] as const) {
      const { pull, mid, oppo } = dirCounts(block.data);
      const t = pull + mid + oppo;
      rows.push([`${label} mix`, pct(pull, t), pct(mid, t), pct(oppo, t), t]);
    }
  }
  return rows;
}

function drawSplitsTable(
  doc: jsPDF,
  title: string,
  stats: BattingStatsWithSplits | null | undefined,
  startY: number
): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, startY);
  autoTable(doc, {
    startY: startY + 5,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Split", "PA", "AB", "H", "AVG", "OBP", "SLG", "OPS"]],
    body: battingSplitRows(stats),
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
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
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(heading, MARGIN, startY);
  autoTable(doc, {
    startY: startY + 2,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Sample", "Pull", "Mid", "Oppo", "BIP", "PA (split)"]],
    body: sprayRows(spray),
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    theme: "striped",
  });
  let y = nextStartY(doc);
  const mix = sprayMixRows(spray);
  if (mix.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["", "Pull", "Mid", "Oppo", "BIP"]],
      body: mix,
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [70, 70, 70], textColor: 255 },
      theme: "striped",
    });
    y = nextStartY(doc);
  }
  return y;
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

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Comparison: ${a.name} vs ${b.name}`, MARGIN, MARGIN + 4);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(`${a.bats ?? "?"} vs ${b.bats ?? "?"} · Splits summary`, MARGIN, MARGIN + 10);

  autoTable(doc, {
    startY: MARGIN + 14,
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
    styles: { fontSize: 7.5, cellPadding: 1 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    theme: "striped",
  });

  let y = nextStartY(doc) + 6;
  if (y > 230) {
    doc.addPage();
    y = MARGIN;
  }
  y = drawSprayTables(doc, bundle.spray[a.id] ?? null, y, `Spray — ${a.name}`);

  y = nextStartY(doc) + 8;
  if (y > 235) {
    doc.addPage();
    y = MARGIN;
  }
  drawSprayTables(doc, bundle.spray[b.id] ?? null, y, `Spray — ${b.name}`);
}

function drawMultiProfile(doc: jsPDF, bundle: HitterReportBundle): void {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const names = bundle.players.map((p) => p.name).join(", ");
  doc.text("Hitter / pitcher spray report", MARGIN, MARGIN + 4);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(names.length > 90 ? `${bundle.players.length} players` : names, MARGIN, MARGIN + 10);

  let y = MARGIN + 18;
  for (let i = 0; i < bundle.players.length; i++) {
    const p = bundle.players[i];
    if (y > 235) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${p.name}${p.jersey ? ` #${p.jersey}` : ""} (${p.bats ?? "?"})`,
      MARGIN,
      y
    );
    y += 4;
    y = drawSplitsTable(doc, "Batting splits", bundle.batting[p.id], y);
    y = drawSprayTables(doc, bundle.spray[p.id] ?? null, y + 4);
    y += 6;
  }
}

export function downloadHitterReportPdf(bundle: HitterReportBundle, options: { compare: boolean }): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
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
  doc.save(`${base}.pdf`);
}
