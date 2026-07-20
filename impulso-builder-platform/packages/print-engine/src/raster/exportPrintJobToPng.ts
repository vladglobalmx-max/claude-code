import { toPixels, type PageId, type Project } from "@impulso/document-schema";
import { resolveActivePage } from "@impulso/renderer-konva";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { PreflightIssue } from "../preflight/types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { buildPrintFilename } from "../naming.js";
import { computeBoxes, type PrintBoxes } from "../boxes.js";
import { physicalToPixels } from "../units.js";
import type { PrintJob } from "../types.js";
import { computeCropMarksGeometry } from "../marks/cropMarksGeometry.js";
import { resolveDieLineSource } from "../cutpath/dieLineDetection.js";
import { normalizeCutGeometry } from "../cutpath/cutGeometry.js";
import { applyCutGeometryOffset } from "../cutpath/cutGeometryOffset.js";
import { cutGeometryToPathSegments } from "../cutpath/cutGeometryToSegments.js";
import { cropMarkSegmentToRaster, cutPathSegmentsToRaster } from "./canonicalToRasterPoints.js";
import { createMediaCanvasWithContent, drawLineSegmentOnCanvas, drawPathSegmentsOnCanvas } from "./composeCanvasOverlays.js";
import { renderPrintJob } from "./renderPrintJob.js";
import type { RenderedPrintPage } from "./renderPrintPage.js";
import type { ShouldRenderObject } from "./objectFilters.js";

export interface ExportPrintJobToPngOptions {
  project: Project;
  printJob: PrintJob;
  resolver: ExportAssetResolver;
  projectName: string;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  shouldRenderObject?: ShouldRenderObject;
  signal?: AbortSignal;
  onProgress?: PrintExportProgressCallback;
  memoryBudgetBytes?: number;
  /** Instant ISO inyectable para el naming determinista — mismo patrón que
   * `createPrintJob`. */
  now: () => string;
}

export interface PrintPngPageResult {
  pageId: PageId;
  filename: string;
  blob: Blob;
  widthPx: number;
  heightPx: number;
}

export interface ExportPrintJobToPngResult {
  format: "png";
  /** Una entrada por página — sección 7: "PNG no debe inventar un
   * contenedor multipágina", el caller decide qué hacer con la colección
   * (descargarlas todas, comprimirlas, etc.). */
  pages: PrintPngPageResult[];
  warnings: PreflightIssue[];
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** `true` si esta página necesita CUALQUIER overlay (marcas o cut path)
 * — cuando no, se codifica el canvas de contenido tal cual, sin gastar
 * memoria/tiempo en un canvas de MediaBox adicional (sección 25:
 * "evitar... un segundo raster completo" cuando no hace falta). */
function needsOverlayComposition(printJob: PrintJob): boolean {
  return printJob.cropMarks.enabled || printJob.cutPath.mode !== "none";
}

/**
 * Cut path vectorial de UNA página, ya en píxeles de RASTER dentro del
 * canvas de MediaBox — `undefined` si `cutPath.mode === "none"`. Ver el
 * mismo helper en `exportPrintJobToPdf.ts` — los `PrintEngineError`
 * lanzados aquí son DEFENSIVOS (Preflight ya debería haber bloqueado
 * cualquier caso inválido antes de llegar aquí).
 */
function buildRasterCutPathOverlay(
  project: Project,
  rendered: RenderedPrintPage,
  printJob: PrintJob,
  bleedOffsetRasterPx: { x: number; y: number },
): { segments: ReturnType<typeof cutPathSegmentsToRaster>; strokeWidthPx: number; color: string } | undefined {
  if (printJob.cutPath.mode === "none") return undefined;

  const page = resolveActivePage(project, rendered.pageId);
  if (!page) {
    throw new PrintEngineError("render-failed", `El Print Job referencia una página ("${rendered.pageId}") que ya no existe en el documento.`);
  }

  const resolution = resolveDieLineSource(page, printJob.cutPath.source);
  if (resolution.status !== "found") {
    throw new PrintEngineError("render-failed", "No se pudo resolver la fuente del cut path — Preflight debería haber bloqueado esto antes.");
  }

  const geometryResult = normalizeCutGeometry(resolution.candidate);
  if (!geometryResult.ok) {
    throw new PrintEngineError("render-failed", `No se pudo normalizar la geometría del cut path (${geometryResult.reason}) — Preflight debería haber bloqueado esto antes.`);
  }

  const offsetCanonicalPx = toPixels(printJob.cutPath.offset, printJob.cutPath.unit);
  const offsetResult = applyCutGeometryOffset(geometryResult.geometry, offsetCanonicalPx);
  if (offsetResult.status === "collapsed") {
    throw new PrintEngineError("render-failed", "El offset del cut path colapsa la geometría — Preflight debería haber bloqueado esto antes.");
  }

  const canonicalSegments = cutGeometryToPathSegments(offsetResult.geometry);
  const contentOffsetCanonical = { x: rendered.geometry.offsetCanonicalX, y: rendered.geometry.offsetCanonicalY };
  const segments = cutPathSegmentsToRaster(canonicalSegments, rendered.geometry.canonicalScale, contentOffsetCanonical, bleedOffsetRasterPx);

  return {
    segments,
    strokeWidthPx: physicalToPixels(printJob.cutPath.stroke, printJob.cutPath.unit, printJob.resolution.targetPpi),
    color: printJob.cutPath.color,
  };
}

/** Compone el canvas final de UNA página: sin overlays, es el canvas de
 * contenido tal cual (BleedBox); con marcas/cut path, se crea un canvas
 * de MediaBox, se posiciona el contenido en su offset (sin escalarlo) y
 * se dibujan las marcas/el cut path DESPUÉS, como vectores reales sobre
 * ese mismo raster — un solo canvas final, nunca un segundo render de
 * Konva (sección 7/25). */
function composeFinalCanvas(
  project: Project,
  rendered: RenderedPrintPage,
  printJob: PrintJob,
  physicalBoxes: PrintBoxes,
): { canvas: HTMLCanvasElement; widthPx: number; heightPx: number } {
  if (!needsOverlayComposition(printJob)) {
    return { canvas: rendered.canvas, widthPx: rendered.widthPx, heightPx: rendered.heightPx };
  }

  const targetPpi = printJob.resolution.targetPpi;
  const mediaRasterWidth = Math.round(physicalToPixels(physicalBoxes.media.width, physicalBoxes.trim.unit, targetPpi));
  const mediaRasterHeight = Math.round(physicalToPixels(physicalBoxes.media.height, physicalBoxes.trim.unit, targetPpi));
  const bleedOffsetRasterPx = {
    x: Math.round(physicalToPixels(physicalBoxes.bleedOffsetWithinMedia.x, physicalBoxes.trim.unit, targetPpi)),
    y: Math.round(physicalToPixels(physicalBoxes.bleedOffsetWithinMedia.y, physicalBoxes.trim.unit, targetPpi)),
  };

  const { canvas, ctx } = createMediaCanvasWithContent(rendered.canvas, mediaRasterWidth, mediaRasterHeight, bleedOffsetRasterPx);

  if (printJob.cropMarks.enabled) {
    const cropMarkSegments = computeCropMarksGeometry(physicalBoxes, printJob.cropMarks);
    for (const segment of cropMarkSegments) {
      drawLineSegmentOnCanvas(ctx, cropMarkSegmentToRaster(segment, targetPpi));
    }
  }

  const cutPathOverlay = buildRasterCutPathOverlay(project, rendered, printJob, bleedOffsetRasterPx);
  if (cutPathOverlay) {
    drawPathSegmentsOnCanvas(ctx, cutPathOverlay.segments, cutPathOverlay.strokeWidthPx, cutPathOverlay.color);
  }

  return { canvas, widthPx: mediaRasterWidth, heightPx: mediaRasterHeight };
}

/**
 * PNG físico de un `PrintJob` (Epic 9 / Fases 9.2-9.3, ver ADR-0022/
 * ADR-0023) — una imagen por página, dimensionada exactamente al
 * BleedBox a `targetPpi` (o al MediaBox cuando hay marcas de corte, con
 * el contenido posicionado en su offset — nunca escalado), con naming
 * determinista y numeración estable de página. Las marcas de corte y el
 * cut path se componen DESPUÉS del contenido, como un dibujo vectorial
 * real sobre el mismo raster — nunca un segundo render de Konva. No
 * incluye overlays de safe area ni objects filtrados (die-line) por
 * construcción — hereda ambas garantías de `renderPrintJob`.
 */
export async function exportPrintJobToPng(options: ExportPrintJobToPngOptions): Promise<ExportPrintJobToPngResult> {
  const { project, printJob, resolver, projectName, fontChecker, imageProbe, shouldRenderObject, signal, onProgress, memoryBudgetBytes, now } = options;

  const { pages, preflight } = await renderPrintJob({
    project,
    printJob,
    resolver,
    fontChecker,
    imageProbe,
    shouldRenderObject,
    signal,
    onProgress,
    memoryBudgetBytes,
  });

  const physicalBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
  const pageCount = printJob.pageIds.length;
  const dateIso = now();
  const results: PrintPngPageResult[] = [];
  let pageNumber = 0;

  for await (const rendered of pages) {
    pageNumber += 1;
    throwIfAborted(signal, `componiendo overlays de la página ${pageNumber}/${pageCount}`);

    const { canvas, widthPx, heightPx } = composeFinalCanvas(project, rendered, printJob, physicalBoxes);
    throwIfAborted(signal, `codificando la página ${pageNumber}/${pageCount} como PNG`);
    emitProgress(onProgress, { stage: "encoding-page", pageIndex: pageNumber - 1, pageCount });

    const blob = await canvasToPngBlob(canvas);
    if (!blob) {
      throw new PrintEngineError(
        "raster-encoding-failed",
        `No se pudo codificar la página ${pageNumber} como PNG a ${printJob.resolution.targetPpi} PPI.`,
      );
    }
    throwIfAborted(signal, `después de codificar la página ${pageNumber}/${pageCount} como PNG`);

    const filename = buildPrintFilename({
      projectName,
      profile: printJob.profile,
      pageIndex: pageNumber,
      pageCount,
      date: dateIso,
      extension: "png",
    });

    results.push({ pageId: rendered.pageId, filename, blob, widthPx, heightPx });
  }

  emitProgress(onProgress, { stage: "finalizing" });
  emitProgress(onProgress, { stage: "completed" });

  return { format: "png", pages: results, warnings: preflight.issues };
}
