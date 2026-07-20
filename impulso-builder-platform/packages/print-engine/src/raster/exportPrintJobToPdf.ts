import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { PreflightIssue } from "../preflight/types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { buildPrintFilename } from "../naming.js";
import type { PrintJob } from "../types.js";
import type { PdfBackend } from "../pdf/pdfBackend.js";
import { pdfLibBackend } from "../pdf/pdfLibBackend.js";
import { computePdfPageBoxes } from "../pdf/pageBoxes.js";
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

/**
 * PDF aplanado de alta resolución de un `PrintJob` (Epic 9 / Fase 9.2,
 * secciones 8-10 del enunciado, ver ADR-0022) — UN solo archivo, una
 * página PDF por página del job, cada una con el raster de contenido
 * incrustado cubriendo exactamente el `BleedBox`/`MediaBox` (iguales en
 * esta fase — sin espacio de marcas todavía) y los 4 boxes físicos
 * (`Trim`/`Bleed`/`Media`/`Crop`) correctos. NUNCA texto seleccionable,
 * NUNCA vectorial, NUNCA CMYK certificado — ver README, "Qué es y qué no
 * es". El backend `pdf-lib` queda completamente aislado detrás de
 * `PdfBackend` (`pdf/pdfBackend.ts`) — este módulo nunca importa `pdf-lib`
 * directamente.
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

  const pageCount = printJob.pageIds.length;
  let pageNumber = 0;

  for await (const rendered of pages) {
    pageNumber += 1;
    throwIfAborted(signal, `antes de incrustar la página ${pageNumber}/${pageCount} en el PDF`);
    emitProgress(onProgress, { stage: "assembling-pdf", pageIndex: pageNumber - 1, pageCount });

    const imageBytes = await canvasToPngBytes(rendered.canvas, pageNumber);
    throwIfAborted(signal, `después de codificar la página ${pageNumber}/${pageCount}, antes de incrustarla`);

    await pdfDocument.addRasterPage({
      mediaWidthPt: boxes.mediaWidthPt,
      mediaHeightPt: boxes.mediaHeightPt,
      imageBytes,
      imageX: 0,
      imageY: 0,
      imageWidthPt: boxes.mediaWidthPt,
      imageHeightPt: boxes.mediaHeightPt,
      mediaBox: boxes.mediaBox,
      bleedBox: boxes.bleedBox,
      trimBox: boxes.trimBox,
      cropBox: boxes.cropBox,
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
