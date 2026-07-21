import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import { runPreflight } from "../preflight/runPreflight.js";
import type { PreflightResult } from "../preflight/types.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import type { PrintJob } from "../types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { createAssetImageCache } from "./assetImageCache.js";
import type { ShouldRenderObject } from "./objectFilters.js";
import { renderPrintPage, type RenderedPrintPage } from "./renderPrintPage.js";

export interface RenderPrintJobOptions {
  project: Project;
  printJob: PrintJob;
  resolver: ExportAssetResolver;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  shouldRenderObject?: ShouldRenderObject;
  signal?: AbortSignal;
  onProgress?: PrintExportProgressCallback;
  memoryBudgetBytes?: number;
}

export interface RenderPrintJobResult {
  /** Una página a la vez, en el orden de `printJob.pageIds` — consumir con
   * `for await...of` (sección 14: procesamiento secuencial, nunca todas
   * las páginas en memoria a la vez). Al terminar de iterar (incluido un
   * `break` o una excepción del propio consumidor), el cache de imágenes
   * de la exportación se libera automáticamente. */
  pages: AsyncGenerator<RenderedPrintPage>;
  /** El resultado completo de Preflight (sección 13) — ya se validó que no
   * tiene errores bloqueantes; los `warnings` quedan disponibles para que
   * el caller los reporte junto al resultado final. */
  preflight: PreflightResult;
}

async function waitForFontsReady(): Promise<void> {
  if (typeof document === "undefined") return;
  const fonts = (document as { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (!fonts?.ready) return;
  try {
    await fonts.ready;
  } catch {
    // Degradación honesta (sección 13, contrato de Fase 9.1): nunca
    // bloquear el render por esto — el preview visual sigue siendo la
    // verificación práctica.
  }
}

/**
 * Orquesta el raster de TODAS las páginas de un `PrintJob` (Epic 9 / Fase
 * 9.2, ver ADR-0022): corre Preflight primero (aborta si hay errores
 * bloqueantes) y expone las páginas como un generador asíncrono — quien lo
 * consume decide cuándo procesar/descartar cada raster antes de pedir el
 * siguiente, nunca las mantiene todas en memoria a la vez.
 *
 * El presupuesto de memoria ("no intentar renderizar para 'ver si
 * funciona'", sección 14) se valida DENTRO de Preflight (`raster_too_large`,
 * ya bloqueante desde Fase 9.1) — nunca se repite aquí un segundo chequeo:
 * el `MediaBox` que usa Preflight para estimarlo (`boxes.ts`) siempre
 * contiene o iguala al `BleedBox` que esta fase realmente rasteriza (ver
 * `coordinates.ts`), así que cualquier tamaño que Preflight aprueba es, como
 * mínimo, igual de seguro para el raster real.
 */
export async function renderPrintJob(options: RenderPrintJobOptions): Promise<RenderPrintJobResult> {
  const { project, printJob, resolver, fontChecker, imageProbe, shouldRenderObject, signal, onProgress, memoryBudgetBytes } = options;

  emitProgress(onProgress, { stage: "validating" });
  throwIfAborted(signal, "antes de Preflight");

  const preflight = await runPreflight(project, printJob, { resolver, fontChecker, imageProbe, memoryBudgetBytes, signal });
  if (preflight.hasBlockingErrors) {
    throw new PrintEngineError(
      "preflight-blocked",
      "El Print Job tiene errores de Preflight que impiden exportar — corrígelos antes de intentar de nuevo.",
      { preflightIssues: preflight.issues.filter((issue) => issue.severity === "error") },
    );
  }
  throwIfAborted(signal, "después de Preflight");

  emitProgress(onProgress, { stage: "preparing-assets" });
  await waitForFontsReady();
  throwIfAborted(signal, "después de preparar assets/fuentes");

  const imageCache = createAssetImageCache(resolver);
  const pageIds = printJob.pageIds;

  async function* pages(): AsyncGenerator<RenderedPrintPage> {
    try {
      for (let index = 0; index < pageIds.length; index++) {
        throwIfAborted(signal, `antes de renderizar la página ${index + 1}/${pageIds.length}`);
        emitProgress(onProgress, { stage: "rendering-page", pageIndex: index, pageCount: pageIds.length });
        const rendered = await renderPrintPage({
          project,
          printJob,
          pageId: pageIds[index]!,
          imageCache,
          shouldRenderObject,
          signal,
        });
        throwIfAborted(signal, `después de renderizar la página ${index + 1}/${pageIds.length}`);
        yield rendered;
      }
    } finally {
      imageCache.dispose();
    }
  }

  return { pages: pages(), preflight };
}
