import type { PageId, Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { PreflightIssue } from "../preflight/types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { buildPrintFilename } from "../naming.js";
import type { PrintJob } from "../types.js";
import { renderPrintJob } from "./renderPrintJob.js";
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

/**
 * PNG físico de un `PrintJob` (Epic 9 / Fase 9.2, sección 7 del enunciado)
 * — una imagen por página, dimensionada exactamente al BleedBox a
 * `targetPpi`, con naming determinista y numeración estable de página. No
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

  const pageCount = printJob.pageIds.length;
  const dateIso = now();
  const results: PrintPngPageResult[] = [];
  let pageNumber = 0;

  for await (const rendered of pages) {
    pageNumber += 1;
    throwIfAborted(signal, `codificando la página ${pageNumber}/${pageCount} como PNG`);
    emitProgress(onProgress, { stage: "encoding-page", pageIndex: pageNumber - 1, pageCount });

    const blob = await canvasToPngBlob(rendered.canvas);
    if (!blob) {
      throw new PrintEngineError(
        "raster-encoding-failed",
        `No se pudo codificar la página ${pageNumber} como PNG a ${printJob.resolution.targetPpi} PPI.`,
      );
    }

    const filename = buildPrintFilename({
      projectName,
      profile: printJob.profile,
      pageIndex: pageNumber,
      pageCount,
      date: dateIso,
      extension: "png",
    });

    results.push({ pageId: rendered.pageId, filename, blob, widthPx: rendered.widthPx, heightPx: rendered.heightPx });
  }

  emitProgress(onProgress, { stage: "finalizing" });
  emitProgress(onProgress, { stage: "completed" });

  return { format: "png", pages: results, warnings: preflight.issues };
}
