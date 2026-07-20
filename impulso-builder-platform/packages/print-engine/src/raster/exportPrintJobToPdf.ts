import { toPixels, type PageId, type Project } from "@impulso/document-schema";
import { resolveActivePage } from "@impulso/renderer-konva";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { PreflightIssue } from "../preflight/types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { buildPrintFilename } from "../naming.js";
import { computeBoxes } from "../boxes.js";
import type { PrintJob } from "../types.js";
import type { PdfBackend, PdfLineOverlay, PdfPathOverlay } from "../pdf/pdfBackend.js";
import { pdfLibBackend } from "../pdf/pdfLibBackend.js";
import { computePdfPageBoxes, type PdfPageBoxes } from "../pdf/pageBoxes.js";
import { cropMarkSegmentToPdf, cutPathSegmentsToPdf } from "../pdf/canonicalToPdfPoints.js";
import { unitToPoints } from "../units.js";
import { computeCropMarksGeometry } from "../marks/cropMarksGeometry.js";
import { resolveDieLineSource } from "../cutpath/dieLineDetection.js";
import { normalizeCutGeometry } from "../cutpath/cutGeometry.js";
import { applyCutGeometryOffset } from "../cutpath/cutGeometryOffset.js";
import { cutGeometryToPathSegments } from "../cutpath/cutGeometryToSegments.js";
import { renderPrintJob } from "./renderPrintJob.js";
import type { ShouldRenderObject } from "./objectFilters.js";

export interface ExportPrintJobToPdfOptions {
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
  /** Instant ISO inyectable para el naming y la metadata del PDF
   * (`CreationDate`/`ModificationDate`) — mismo patrón que
   * `createPrintJob`/`exportPrintJobToPng`. Determinismo (sección 18): dos
   * exportaciones con el mismo `now` producen el mismo nombre y la misma
   * fecha embebida — pdf-lib puede seguir variando otros bytes internos
   * (IDs de objeto), documentado como no-determinismo aceptado. */
  now: () => string;
  /** Inyectable para tests de dominio que nunca necesitan conocer
   * `pdf-lib` — por defecto, `pdfLibBackend` (el único backend real). */
  backend?: PdfBackend;
}

export interface ExportPrintJobToPdfResult {
  format: "pdf";
  filename: string;
  blob: Blob;
  pageCount: number;
  warnings: PreflightIssue[];
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function canvasToPngBytes(canvas: HTMLCanvasElement, pageNumber: number): Promise<Uint8Array> {
  const blob = await canvasToPngBlob(canvas);
  if (!blob) {
    throw new PrintEngineError("raster-encoding-failed", `No se pudo codificar la página ${pageNumber} como PNG para incrustar en el PDF.`);
  }
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Marcas de corte de TODO el job, ya en puntos PDF — dependen solo de
 * `printJob.dimensions`/`bleed`/`cropMarks` (nunca del contenido de una
 * página en particular), así que se calculan UNA sola vez y se reutilizan
 * para cada página — no es "reutilizar geometría de la página 1"
 * (sección 24): esta geometría es, por diseño del modelo actual de
 * `PrintJob`, la misma para cualquier página del mismo job. `[]` si
 * `cropMarks.enabled` es `false`. */
function buildCropMarkOverlays(printJob: PrintJob, pdfBoxes: PdfPageBoxes): PdfLineOverlay[] {
  if (!printJob.cropMarks.enabled) return [];
  const physicalBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
  const segments = computeCropMarksGeometry(physicalBoxes, printJob.cropMarks);
  return segments.map((segment) => cropMarkSegmentToPdf(segment, pdfBoxes.mediaHeightPt));
}

/**
 * Cut path vectorial de UNA página, ya en puntos PDF — `undefined` si
 * `cutPath.mode === "none"`. Cada paso (resolución de fuente,
 * normalización de geometría, offset) asume que Preflight YA bloqueó
 * cualquier caso inválido antes de llegar aquí (`cut_path_missing`/
 * `cut_path_multiple_candidates`/`cut_path_unsupported_object`/
 * `cut_path_open`/`cut_path_transform_unsupported`/`cut_path_collapsed`)
 * — los `PrintEngineError` lanzados en este helper son DEFENSIVOS
 * (inconsistencia interna real, nunca deberían dispararse en un flujo
 * normal), no una segunda validación de negocio duplicada.
 */
function buildCutPathOverlay(project: Project, pageId: PageId, printJob: PrintJob, pdfBoxes: PdfPageBoxes): PdfPathOverlay | undefined {
  if (printJob.cutPath.mode === "none") return undefined;

  const page = resolveActivePage(project, pageId);
  if (!page) {
    throw new PrintEngineError("render-failed", `El Print Job referencia una página ("${pageId}") que ya no existe en el documento.`);
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

  const segments = cutGeometryToPathSegments(offsetResult.geometry);
  const pdfSegments = cutPathSegmentsToPdf(segments, pdfBoxes.trimBox);

  return {
    segments: pdfSegments,
    strokeWidthPt: unitToPoints(printJob.cutPath.stroke, printJob.cutPath.unit),
    colorHex: printJob.cutPath.color,
  };
}

/**
 * PDF aplanado de alta resolución de un `PrintJob` (Epic 9 / Fases 9.2-9.3,
 * ver ADR-0022/ADR-0023) — UN solo archivo, una página PDF por página del
 * job, cada una con el raster de contenido incrustado cubriendo
 * exactamente el `BleedBox` (posicionado dentro de un `MediaBox` que
 * puede ser MÁS GRANDE cuando hay marcas de corte — el raster NUNCA se
 * escala para "hacer espacio", solo se desplaza, sección 5 de Fase 9.3) y
 * los 4 boxes físicos (`Trim`/`Bleed`/`Media`/`Crop`) correctos. Las
 * marcas de corte y el cut path se dibujan DESPUÉS del raster, como
 * vectores reales (`pdf/pdfBackend.ts`'s `cropMarks`/`cutPath`) — nunca
 * rasterizados junto con el contenido. NUNCA texto seleccionable, NUNCA
 * vectorial el contenido en sí, NUNCA CMYK certificado — ver README, "Qué
 * es y qué no es". El backend `pdf-lib` queda completamente aislado
 * detrás de `PdfBackend` (`pdf/pdfBackend.ts`) — este módulo nunca importa
 * `pdf-lib` directamente.
 */
export async function exportPrintJobToPdf(options: ExportPrintJobToPdfOptions): Promise<ExportPrintJobToPdfResult> {
  const {
    project,
    printJob,
    resolver,
    projectName,
    fontChecker,
    imageProbe,
    shouldRenderObject,
    signal,
    onProgress,
    memoryBudgetBytes,
    now,
    backend = pdfLibBackend,
  } = options;

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

  const boxes = computePdfPageBoxes(printJob);
  const nowIso = now();
  const pdfDocument = backend.createDocument({ producer: "Impulso Print Engine", creationDate: new Date(nowIso) });

  // Las marcas de corte dependen solo de dimensiones/bleed/cropMarks del
  // job (nunca del contenido de una página) — se calculan una sola vez,
  // ver `buildCropMarkOverlays`. El cut path SÍ depende del contenido de
  // cada página (die-line propio) y se recalcula dentro del loop.
  const cropMarkOverlays = buildCropMarkOverlays(printJob, boxes);

  const pageCount = printJob.pageIds.length;
  let pageNumber = 0;

  for await (const rendered of pages) {
    pageNumber += 1;
    throwIfAborted(signal, `antes de incrustar la página ${pageNumber}/${pageCount} en el PDF`);
    emitProgress(onProgress, { stage: "assembling-pdf", pageIndex: pageNumber - 1, pageCount });

    const imageBytes = await canvasToPngBytes(rendered.canvas, pageNumber);
    throwIfAborted(signal, `después de codificar la página ${pageNumber}/${pageCount}, antes de incrustarla`);

    const cutPathOverlay = buildCutPathOverlay(project, rendered.pageId, printJob, boxes);
    throwIfAborted(signal, `después de normalizar el cut path de la página ${pageNumber}/${pageCount}`);

    await pdfDocument.addRasterPage({
      mediaWidthPt: boxes.mediaWidthPt,
      mediaHeightPt: boxes.mediaHeightPt,
      imageBytes,
      // El raster cubre exactamente el BleedBox — se posiciona en su
      // offset dentro del MediaBox (0,0 cuando no hay marcas), nunca se
      // escala para llenar un MediaBox más grande (sección 5).
      imageX: boxes.bleedBox.x,
      imageY: boxes.bleedBox.y,
      imageWidthPt: boxes.bleedBox.width,
      imageHeightPt: boxes.bleedBox.height,
      mediaBox: boxes.mediaBox,
      bleedBox: boxes.bleedBox,
      trimBox: boxes.trimBox,
      cropBox: boxes.cropBox,
      cropMarks: cropMarkOverlays,
      cutPath: cutPathOverlay,
    });
    throwIfAborted(signal, `después de incrustar la página ${pageNumber}/${pageCount}`);
  }

  emitProgress(onProgress, { stage: "finalizing" });
  throwIfAborted(signal, "antes de guardar el PDF final (save)");
  const bytes = await pdfDocument.save();
  throwIfAborted(signal, "después de guardar el PDF final, antes de entregar el resultado");
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

  const filename = buildPrintFilename({
    projectName,
    profile: printJob.profile,
    // Un PDF multipágina es UN solo archivo — nunca se numera por página
    // (a diferencia de PNG, sección 7) — `pageCount: 1` refleja eso para
    // el naming, sin relación con `ExportPrintJobToPdfResult.pageCount`.
    pageCount: 1,
    date: nowIso,
    extension: "pdf",
  });

  emitProgress(onProgress, { stage: "completed" });

  return { format: "pdf", filename, blob, pageCount, warnings: preflight.issues };
}
