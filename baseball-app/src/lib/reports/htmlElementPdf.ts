import type { jsPDF } from "jspdf";
import { deliverJsPdf } from "@/lib/reports/pdfDelivery";

const CAPTURE_CLASS = "reports-pdf-capture";
/** Raster width at 96dpi — matches letter page width in each orientation. */
const LETTER_CAPTURE_WIDTH_PX = {
  portrait: Math.round(8.5 * 96),
  landscape: Math.round(11 * 96),
} as const;
const MAX_CANVAS_PX = 14_000;
const PDF_MARGIN_MM = 6;

async function waitForCaptureReady(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function capturePixelRatio(element: HTMLElement, preferred = 2): number {
  const w = element.scrollWidth || element.offsetWidth;
  const h = element.scrollHeight || element.offsetHeight;
  if (w < 1 || h < 1) return preferred;
  const maxDim = Math.max(w, h);
  if (maxDim * preferred <= MAX_CANVAS_PX) return preferred;
  return Math.max(1, Math.floor((MAX_CANVAS_PX / maxDim) * 10) / 10);
}

const CAPTURE_STYLE_ID = "reports-pdf-capture-style";

function mountCaptureStyles(captureClass: string): void {
  if (document.getElementById(CAPTURE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CAPTURE_STYLE_ID;
  style.textContent = `
    .${captureClass} .reports-screen-only,
    .${captureClass} [data-pdf-exclude="true"] {
      display: none !important;
    }
    .${captureClass}.pregame-report-root,
    .${captureClass}.pregame-report-root *,
    .${captureClass}.game-review-detailed-report-root,
    .${captureClass}.game-review-detailed-report-root * {
      box-shadow: none !important;
      text-shadow: none !important;
      filter: none !important;
      backdrop-filter: none !important;
    }
    .${captureClass} *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

export function unmountCaptureStyles(): void {
  document.getElementById(CAPTURE_STYLE_ID)?.remove();
}

function isUnsupportedColor(value: string): boolean {
  return (
    value.includes("lab(") ||
    value.includes("oklch(") ||
    value.includes("color(") ||
    value.includes("color-mix(")
  );
}

function sanitizeUnsupportedColors(root: HTMLElement): void {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const node of nodes) {
    try {
      const cs = getComputedStyle(node);
      if (isUnsupportedColor(cs.color)) node.style.color = "#0f172a";
      if (isUnsupportedColor(cs.backgroundColor)) node.style.backgroundColor = "#ffffff";
      if (isUnsupportedColor(cs.borderTopColor)) node.style.borderColor = "#cbd5e1";
      if (cs.backgroundImage && cs.backgroundImage !== "none" && cs.backgroundImage.includes("gradient")) {
        node.style.backgroundImage = "none";
        if (!node.style.backgroundColor) node.style.backgroundColor = "#ffffff";
      }
    } catch {
      /* ignore */
    }
  }
}

/** Remove nodes excluded from PDF layout. Do not remove `.reports-screen-only` — those stay in the DOM for the live page. */
function stripPdfExcludedNodes(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-pdf-exclude='true']").forEach((el) => {
    el.remove();
  });
}

/** Expand tables and remove scroll clipping before rasterizing. */
function prepareDomForPdfCapture(root: HTMLElement): void {
  stripPdfExcludedNodes(root);
  root.querySelectorAll<HTMLElement>(".overflow-x-auto, .overflow-auto, .overflow-hidden").forEach((el) => {
    el.style.overflow = "visible";
    el.style.overflowX = "visible";
    el.style.maxWidth = "100%";
    if (el.classList.contains("overflow-x-auto") || el.classList.contains("overflow-auto")) {
      el.style.width = "100%";
    }
  });

  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.style.borderCollapse = "collapse";
    if (
      table.classList.contains("postgame-linescore-table") ||
      table.classList.contains("box-score-linescore-table")
    ) {
      table.style.width = "auto";
      table.style.maxWidth = "100%";
      table.style.tableLayout = "auto";
      return;
    }
    table.style.width = "100%";
    table.style.maxWidth = "100%";
    if (table.classList.contains("pregame-pitching-ext-table")) {
      table.style.tableLayout = "auto";
      return;
    }
    table.style.tableLayout = "fixed";
  });

  root.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
    if (
      cell.closest(".pregame-pitching-ext-table") ||
      cell.closest(".postgame-linescore-table") ||
      cell.closest(".box-score-linescore-table")
    ) {
      return;
    }
    cell.style.whiteSpace = "normal";
    cell.style.wordBreak = "break-word";
    cell.style.overflow = "visible";
    cell.style.maxWidth = "none";
  });

  root.querySelectorAll<HTMLElement>(".game-review-pdf-player-block, .game-review-pdf-subsection-unit").forEach((el) => {
    el.style.overflow = "visible";
    el.style.maxHeight = "none";
  });
}

function isPdfExcluded(el: HTMLElement): boolean {
  return el.classList.contains("reports-screen-only") || el.dataset.pdfExclude === "true";
}

/** Top-level blocks, or `data-pdf-subsection` slices inside large sections (e.g. pitcher stats). */
function pdfCaptureUnits(root: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || isPdfExcluded(child)) continue;

    const subsections = Array.from(child.children).filter(
      (c): c is HTMLElement =>
        c instanceof HTMLElement && c.dataset.pdfSubsection != null && !isPdfExcluded(c)
    );

    if (subsections.length > 0) {
      units.push(...subsections);
    } else {
      units.push(child);
    }
  }
  return units;
}

async function rasterizeWithHtml2Canvas(
  element: HTMLElement,
  pixelRatio: number
): Promise<HTMLCanvasElement> {
  const mod = await import("html2canvas");
  const html2canvas = mod.default ?? mod;
  return html2canvas(element, {
    scale: pixelRatio,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

async function rasterizeElement(element: HTMLElement, pixelRatio: number): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");

  try {
    return await toCanvas(element, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      skipAutoScale: true,
      skipFonts: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.classList.contains("reports-screen-only")) return false;
        if (node.closest(".reports-screen-only")) return false;
        if (node.dataset.pdfExclude === "true") return false;
        return true;
      },
      style: { margin: "0" },
    });
  } catch {
    return rasterizeWithHtml2Canvas(element, pixelRatio);
  }
}

async function captureAtBestRatio(element: HTMLElement): Promise<HTMLCanvasElement> {
  const ratios = [capturePixelRatio(element, 2), capturePixelRatio(element, 1.5), 1].filter(
    (r, i, arr) => arr.indexOf(r) === i
  );
  let lastErr: unknown;
  for (const ratio of ratios) {
    try {
      return await rasterizeElement(element, ratio);
    } catch (err) {
      lastErr = err;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : "Capture failed";
  throw new Error(msg);
}

const MIN_PAGE_SLICE_PX = 72;
/** Merge a tiny tail onto the current slice instead of emitting a near-blank PDF page. */
const TRAILING_SLICE_MERGE_RATIO = 0.14;
const TRAILING_SLICE_MERGE_MAX_PX = 240;

/** Shrink a page slice so it does not cut through `data-pdf-avoid-break` blocks. */
function adjustSliceHeightForAvoidBreaks(
  element: HTMLElement,
  sourceY: number,
  maxSlicePx: number,
  canvasHeight: number
): number {
  const remaining = canvasHeight - sourceY;
  let sliceH = Math.min(maxSlicePx, remaining);
  if (sliceH <= MIN_PAGE_SLICE_PX) return sliceH;

  const scrollH = element.scrollHeight || element.offsetHeight;
  if (scrollH < 1) return sliceH;

  const scaleY = canvasHeight / scrollH;
  const rootTop = element.getBoundingClientRect().top;
  const sliceEnd = sourceY + sliceH;

  for (const el of element.querySelectorAll<HTMLElement>("[data-pdf-avoid-break], .game-review-pdf-player-block")) {
    const r = el.getBoundingClientRect();
    const top = (r.top - rootTop) * scaleY;
    const bottom = (r.bottom - rootTop) * scaleY;
    const blockH = bottom - top;
    const wouldSplit = top > sourceY + 6 && sliceEnd > top + 6 && sliceEnd < bottom - 6;
    if (wouldSplit) {
      const beforeBlock = Math.floor(top - sourceY);
      if (beforeBlock >= MIN_PAGE_SLICE_PX) {
        sliceH = Math.min(sliceH, beforeBlock);
      } else if (sourceY > 0 && blockH <= maxSlicePx + 4) {
        // Block fits on one page but not in remaining space — start on next slice.
        sliceH = Math.min(sliceH, Math.max(MIN_PAGE_SLICE_PX, beforeBlock));
      }
    }
  }

  return Math.max(MIN_PAGE_SLICE_PX, Math.min(sliceH, remaining));
}

/** Slice canvas into page-sized strips — avoids gaps from full-image offset paging. */
function addCanvasToPdf(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  sourceElement: HTMLElement,
  options: {
    marginMm?: number;
    onPageAdded?: (pageNumber: number) => void;
  } = {}
): void {
  const marginMm = options.marginMm ?? PDF_MARGIN_MM;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentW = pageWidth - marginMm * 2;
  const contentH = pageHeight - marginMm * 2;
  const scale = contentW / canvas.width;
  const pageSlicePx = Math.floor(contentH / scale);

  if (pageSlicePx < 1) {
    throw new Error("PDF page layout error.");
  }

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    if (pageIndex > 0) doc.addPage();

    const maxSlice = Math.min(pageSlicePx, canvas.height - sourceY);
    let sliceH = adjustSliceHeightForAvoidBreaks(sourceElement, sourceY, maxSlice, canvas.height);
    const tailPx = canvas.height - sourceY - sliceH;
    const mergeTailThreshold = Math.min(
      TRAILING_SLICE_MERGE_MAX_PX,
      Math.floor(pageSlicePx * TRAILING_SLICE_MERGE_RATIO)
    );
    if (tailPx > 0 && tailPx <= mergeTailThreshold) {
      sliceH = canvas.height - sourceY;
    }
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) throw new Error("Could not render PDF page.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceH);
    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    const useJpeg = sliceH > 4_000;
    const imgData = useJpeg
      ? sliceCanvas.toDataURL("image/jpeg", 0.92)
      : sliceCanvas.toDataURL("image/png", 1);
    const format = useJpeg ? "JPEG" : "PNG";
    const sliceHeightMm = sliceH * scale;

    doc.addImage(imgData, format, marginMm, marginMm, contentW, sliceHeightMm);
    options.onPageAdded?.(doc.getNumberOfPages());

    sourceY += sliceH;
    pageIndex += 1;
  }
}

function pdfContentWidthMm(orientation: "portrait" | "landscape", marginMm: number): number {
  const pageWidth = orientation === "portrait" ? 215.9 : 279.4;
  return pageWidth - marginMm * 2;
}

function pdfContentHeightMm(orientation: "portrait" | "landscape", marginMm: number): number {
  const pageHeight = orientation === "portrait" ? 279.4 : 215.9;
  return pageHeight - marginMm * 2;
}

function estimateSliceCountForElement(
  element: HTMLElement,
  orientation: "portrait" | "landscape",
  marginMm = PDF_MARGIN_MM
): number {
  const h = element.scrollHeight || element.offsetHeight;
  if (h < 1) return 0;
  const captureWidthPx = LETTER_CAPTURE_WIDTH_PX[orientation];
  const contentW = pdfContentWidthMm(orientation, marginMm);
  const contentH = pdfContentHeightMm(orientation, marginMm);
  const scale = contentW / captureWidthPx;
  const pageSlicePx = Math.floor(contentH / scale);
  if (pageSlicePx < 1) return 1;
  return Math.max(1, Math.ceil(h / pageSlicePx));
}

function applyPdfFooters(doc: jsPDF, footerLeft: string | undefined, marginMm: number): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const y = pageHeight - marginMm * 0.55;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (footerLeft) {
      doc.text(footerLeft, marginMm, y);
    }
    doc.text(`Page ${i} of ${total}`, pageWidth - marginMm, y, { align: "right" });
  }
}

function applyCaptureWidth(element: HTMLElement, captureWidthPx: number): void {
  element.style.width = `${captureWidthPx}px`;
  element.style.maxWidth = `${captureWidthPx}px`;
  element.style.boxSizing = "border-box";
}

export type PdfExportProgress = {
  sectionIndex: number;
  sectionCount: number;
  pageNumber: number;
  estimatedTotalPages: number;
};

export type DownloadElementPdfOptions = {
  captureClass?: string;
  orientation?: "portrait" | "landscape";
  /** Capture each top-level child separately — cleaner page breaks for long reports. */
  splitByTopLevelSections?: boolean;
  /** Left-aligned footer text on every page (page numbers added automatically). */
  footerLeft?: string;
  onProgress?: (progress: PdfExportProgress) => void;
};

export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: DownloadElementPdfOptions = {}
): Promise<void> {
  const captureClass = options.captureClass ?? CAPTURE_CLASS;
  const orientation = options.orientation ?? "portrait";
  const captureWidthPx = LETTER_CAPTURE_WIDTH_PX[orientation];
  const orientationClass =
    orientation === "landscape" ? "reports-pdf-capture-landscape" : "reports-pdf-capture-portrait";

  const prevWidth = element.style.width;
  const prevMaxWidth = element.style.maxWidth;

  element.classList.add(captureClass, orientationClass);
  applyCaptureWidth(element, captureWidthPx);
  mountCaptureStyles(captureClass);

  try {
    await waitForCaptureReady();
    sanitizeUnsupportedColors(element);
    prepareDomForPdfCapture(element);

    const { jsPDF: JsPDF } = await import("jspdf");
    const doc = new JsPDF({
      orientation,
      unit: "mm",
      format: "letter",
    });

    const targets = options.splitByTopLevelSections ? pdfCaptureUnits(element) : [element];
    const visibleTargets = targets.filter((target) => {
      applyCaptureWidth(target, captureWidthPx);
      const h = target.scrollHeight || target.offsetHeight;
      return h >= 1;
    });

    if (visibleTargets.length === 0) {
      throw new Error("Report has no visible content to export.");
    }

    const sectionEstimates = visibleTargets.map((target) =>
      estimateSliceCountForElement(target, orientation)
    );
    let estimatedTotalPages = sectionEstimates.reduce((sum, n) => sum + n, 0) || 1;

    const reportProgress = (sectionIndex: number, pageNumber: number) => {
      options.onProgress?.({
        sectionIndex,
        sectionCount: visibleTargets.length,
        pageNumber,
        estimatedTotalPages,
      });
    };

    reportProgress(1, 1);

    for (let i = 0; i < visibleTargets.length; i++) {
      const target = visibleTargets[i]!;
      applyCaptureWidth(target, captureWidthPx);
      prepareDomForPdfCapture(target);

      reportProgress(i + 1, doc.getNumberOfPages() || 1);

      const canvas = await captureAtBestRatio(target);
      const pagesBeforeSection = doc.getNumberOfPages();
      if (options.splitByTopLevelSections && i > 0 && pagesBeforeSection > 0) {
        doc.addPage();
      }
      addCanvasToPdf(doc, canvas, target, {
        marginMm: PDF_MARGIN_MM,
        onPageAdded: (pageNumber) => {
          estimatedTotalPages = Math.max(estimatedTotalPages, pageNumber);
          reportProgress(i + 1, pageNumber);
        },
      });
    }

    if (doc.getNumberOfPages() === 0) {
      throw new Error("Report has no visible content to export.");
    }

    if (options.footerLeft) {
      applyPdfFooters(doc, options.footerLeft, PDF_MARGIN_MM);
    }

    deliverJsPdf(doc, filename);
  } finally {
    element.classList.remove(captureClass, orientationClass);
    element.style.width = prevWidth;
    element.style.maxWidth = prevMaxWidth;
    unmountCaptureStyles();
  }
}
