import { toPixels, type PageId, type PathSegment, type Project, type Unit } from "@impulso/document-schema";
import { resolveActivePage } from "@impulso/renderer-konva";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { PrintEngineError, throwIfAborted } from "../errors.js";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { runPreflight } from "../preflight/runPreflight.js";
import type { PreflightIssue } from "../preflight/types.js";
import { emitProgress, type PrintExportProgressCallback } from "../progress.js";
import { buildPrintFilename } from "../naming.js";
import { computeBoxes, type PrintBoxes } from "../boxes.js";
import { physicalToPixels } from "../units.js";
import { estimateMemoryBytes, DEFAULT_MEMORY_BUDGET_BYTES } from "../memory.js";
import type { PrintJob } from "../types.js";
import { computeCropMarksGeometry, type CropMarkSegment } from "../marks/cropMarksGeometry.js";
import { cropMarkSegmentToRaster, cutPathSegmentsToRaster, type RasterLineSegment } from "./canonicalToRasterPoints.js";
import { createBlankCanvas, drawLineSegmentOnCanvas, drawPathSegmentsOnCanvas } from "./composeCanvasOverlays.js";
import { resolveDieLineSource } from "../cutpath/dieLineDetection.js";
import { normalizeCutGeometry } from "../cutpath/cutGeometry.js";
import { applyCutGeometryOffset } from "../cutpath/cutGeometryOffset.js";
import { cutGeometryToPathSegments } from "../cutpath/cutGeometryToSegments.js";
import { computeImpositionLayout, type ImpositionLayout } from "../imposition/impositionLayout.js";
import { createAssetImageCache } from "./assetImageCache.js";
import { createPieceRasterCache } from "./pieceRasterCache.js";
import type { RenderedPrintPage } from "./renderPrintPage.js";
import type { ShouldRenderObject } from "./objectFilters.js";

export interface ExportImpositionToPngOptions {
  project: Project;
  /** `printJob.imposition.mode` DEBE ser `"grid"` — llamar a esta función
   * con `"single"` es un error de programación (mismo criterio que
   * `exportImpositionToPdf`/`computeImpositionLayout`). */
  printJob: PrintJob;
  resolver: ExportAssetResolver;
  projectName: string;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  shouldRenderObject?: ShouldRenderObject;
  signal?: AbortSignal;
  onProgress?: PrintExportProgressCallback;
  memoryBudgetBytes?: number;
  now: () => string;
}

export interface ImposedPngSheetResult {
  pageId: PageId;
  sheetIndex: number;
  filename: string;
  blob: Blob;
  widthPx: number;
  heightPx: number;
}

export interface ExportImpositionToPngResult {
  format: "png";
  /** Una entrada por HOJA física (sección 9: "PNG no debe inventar un
   * contenedor multipágina", nunca un ZIP sin necesidad confirmada) — el
   * caller decide qué hacer con la colección. */
  sheets: ImposedPngSheetResult[];
  warnings: PreflightIssue[];
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Cut path vectorial BASE de una página (canónico, ya normalizado y
 * offseteado) — se calcula UNA sola vez por página de origen, nunca por
 * copia colocada (sección 17). `undefined` si `cutPath.mode === "none"`.
 * Idéntico en espíritu al homónimo de `exportImpositionToPdf.ts`/
 * `exportPrintJobToPng.ts` — los `PrintEngineError` lanzados aquí son
 * DEFENSIVOS ("Preflight debería haber bloqueado esto antes"). */
function buildBaseCutPathSegments(project: Project, pageId: PageId, printJob: PrintJob): PathSegment[] | undefined {
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

  return cutGeometryToPathSegments(offsetResult.geometry);
}

/** Las 8 marcas de corte de UNA pieza (relativas al origen de su propio
 * footprint, en `printJob.dimensions.unit`) — `[]` si `marksMode !==
 * "per-piece"`. Página-independiente, se calcula una sola vez y se
 * traduce por copia (idéntico a `exportImpositionToPdf.ts`). */
function buildPerPieceCropMarkSegments(printJob: PrintJob, pieceBoxes: PrintBoxes, includePerPiece: boolean): CropMarkSegment[] {
  if (!includePerPiece) return [];
  return computeCropMarksGeometry(pieceBoxes, { ...printJob.cropMarks, enabled: true });
}

/** Traduce las marcas BASE de una pieza (relativas a su footprint) a la
 * posición absoluta de una copia colocada en la hoja, y las convierte a
 * píxeles de raster a `targetPpi`. */
function placedCropMarksToRaster(baseSegments: CropMarkSegment[], footprintPosition: { x: number; y: number }, sheetUnit: Unit, targetPpi: number): RasterLineSegment[] {
  return baseSegments.map((segment) => {
    const translated: CropMarkSegment = {
      unit: sheetUnit,
      strokeWidth: segment.strokeWidth,
      color: segment.color,
      from: { x: footprintPosition.x + segment.from.x, y: footprintPosition.y + segment.from.y },
      to: { x: footprintPosition.x + segment.to.x, y: footprintPosition.y + segment.to.y },
    };
    return cropMarkSegmentToRaster(translated, targetPpi);
  });
}

/** `PrintBoxes` sintético para un rectángulo puro — reutiliza
 * `computeCropMarksGeometry` a nivel de HOJA (marcas `"per-sheet"`),
 * idéntico al homónimo de `exportImpositionToPdf.ts`. */
function buildRectPrintBoxes(width: number, height: number, unit: Unit): PrintBoxes {
  const size = { width, height, unit };
  return {
    trim: size,
    bleed: size,
    media: size,
    safeArea: size,
    trimOffsetWithinMedia: { x: 0, y: 0 },
    trimOffsetWithinBleed: { x: 0, y: 0 },
    safeAreaOffsetWithinTrim: { x: 0, y: 0 },
    bleedPerSide: { top: 0, right: 0, bottom: 0, left: 0 },
    bleedOffsetWithinMedia: { x: 0, y: 0 },
  };
}

/** Las marcas de corte "per-sheet" de una hoja — un solo contorno de 8
 * marcas alrededor del área útil general (después de márgenes), igual
 * para toda hoja de esta página — se calcula una sola vez por página. */
function buildPerSheetCropMarkOverlays(layout: ImpositionLayout, printJob: PrintJob, targetPpi: number): RasterLineSegment[] {
  if (printJob.imposition.mode !== "grid" || printJob.imposition.marksMode !== "per-sheet") return [];

  const area = layout.sheet.usefulArea;
  const boxes = buildRectPrintBoxes(area.width, area.height, layout.unit);
  const segments = computeCropMarksGeometry(boxes, { ...printJob.cropMarks, enabled: true });

  return segments.map((segment) => {
    const translated: CropMarkSegment = {
      unit: layout.unit,
      strokeWidth: segment.strokeWidth,
      color: segment.color,
      from: { x: area.x + segment.from.x, y: area.y + segment.from.y },
      to: { x: area.x + segment.to.x, y: area.y + segment.to.y },
    };
    return cropMarkSegmentToRaster(translated, targetPpi);
  });
}

/**
 * PNG(s) de una imposición (Epic 9 / Fase 9.4, ver ADR de imposición) —
 * UNA imagen por HOJA física (nunca un contenedor multipágina, sección 9),
 * cada hoja dimensionada exactamente a su tamaño físico a `targetPpi`, con
 * N copias de la MISMA pieza rasterizada UNA sola vez
 * (`createPieceRasterCache`) compuestas N veces sobre el canvas de esa
 * hoja — nunca se re-rasteriza por copia (sección 13). Marcas de corte y
 * cut path se dibujan DESPUÉS de las imágenes, como vectores reales sobre
 * el mismo canvas (mismo orden que `exportPrintJobToPng.ts`) — el cut path
 * se normaliza/offsetea UNA sola vez por página de origen y solo se
 * TRASLADA por copia (sección 17). Procesa las hojas SECUENCIALMENTE — un
 * solo canvas de hoja vivo a la vez (sección 25/38), validando su
 * presupuesto de memoria ANTES de crearlo (sección 14/21).
 */
export async function exportImpositionToPng(options: ExportImpositionToPngOptions): Promise<ExportImpositionToPngResult> {
  const { project, printJob, resolver, projectName, fontChecker, imageProbe, shouldRenderObject, signal, onProgress, memoryBudgetBytes, now } = options;

  if (printJob.imposition.mode !== "grid") {
    throw new Error("exportImpositionToPng solo aplica cuando printJob.imposition.mode === 'grid'");
  }
  const imposition = printJob.imposition;
  const targetPpi = printJob.resolution.targetPpi;

  emitProgress(onProgress, { stage: "validating" });
  throwIfAborted(signal, "antes de Preflight");

  const preflight = await runPreflight(project, printJob, { resolver, fontChecker, imageProbe, memoryBudgetBytes });
  if (preflight.hasBlockingErrors) {
    throw new PrintEngineError(
      "preflight-blocked",
      "El Print Job tiene errores de Preflight que impiden exportar — corrígelos antes de intentar de nuevo.",
      { preflightIssues: preflight.issues.filter((issue) => issue.severity === "error") },
    );
  }
  throwIfAborted(signal, "después de Preflight");

  const layouts: ImpositionLayout[] = [];
  for (const pageId of printJob.pageIds) {
    const result = computeImpositionLayout(printJob, pageId);
    if (!result.ok) {
      throw new PrintEngineError(
        "imposition-does-not-fit",
        `La imposición de la página "${pageId}" no es válida (${result.reason}) — Preflight debería haber bloqueado esto antes.`,
      );
    }
    layouts.push(result.layout);
  }
  throwIfAborted(signal, "después de calcular la imposición");

  emitProgress(onProgress, { stage: "preparing-assets" });
  const imageCache = createAssetImageCache(resolver);
  const pieceCache = createPieceRasterCache();

  try {
    const includePerPieceMarks = imposition.marksMode === "per-piece";
    const pieceBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, { ...printJob.cropMarks, enabled: includePerPieceMarks });
    const perPieceMarkSegments = buildPerPieceCropMarkSegments(printJob, pieceBoxes, includePerPieceMarks);

    // Rasteriza UNA sola vez por página de origen — nunca por copia
    // colocada (sección 13). `renderedByPage` mantiene vivo el canvas
    // reutilizado durante TODA la exportación (liberado por GC recién al
    // salir de este `try`, junto con el resto de la cache).
    const renderedByPage = new Map<PageId, RenderedPrintPage>();
    const cutPathByPage = new Map<PageId, PathSegment[] | undefined>();
    let cachedPieceBytes = 0;

    let renderIndex = 0;
    for (const layout of layouts) {
      throwIfAborted(signal, `antes de rasterizar la pieza de la página "${layout.pageId}"`);
      emitProgress(onProgress, { stage: "rendering-page", pageIndex: renderIndex, pageCount: layouts.length });

      const rendered = await pieceCache.get(layout.pageId, { project, printJob, imageCache, shouldRenderObject, signal });
      throwIfAborted(signal, `después de rasterizar la pieza de la página "${layout.pageId}"`);

      renderedByPage.set(layout.pageId, rendered);
      cachedPieceBytes += rendered.widthPx * rendered.heightPx * 4;
      cutPathByPage.set(layout.pageId, buildBaseCutPathSegments(project, layout.pageId, printJob));
      renderIndex += 1;
    }

    const totalSheets = layouts.reduce((sum, layout) => sum + layout.sheetCount, 0);
    const dateIso = now();
    const results: ImposedPngSheetResult[] = [];
    let sheetIndex = 0;

    for (const layout of layouts) {
      const rendered = renderedByPage.get(layout.pageId);
      if (!rendered) {
        throw new PrintEngineError("render-failed", `No se encontró el raster de la página "${layout.pageId}" — inconsistencia interna del exportador.`);
      }
      const baseCutPathSegments = cutPathByPage.get(layout.pageId);
      const contentOffsetCanonical = { x: rendered.geometry.offsetCanonicalX, y: rendered.geometry.offsetCanonicalY };
      const canonicalScale = rendered.geometry.canonicalScale;

      const sheetWidthPx = Math.round(physicalToPixels(layout.sheet.width, layout.unit, targetPpi));
      const sheetHeightPx = Math.round(physicalToPixels(layout.sheet.height, layout.unit, targetPpi));
      const perSheetMarkOverlays = buildPerSheetCropMarkOverlays(layout, printJob, targetPpi);
      const cutPathStrokeWidthPx = printJob.cutPath.mode !== "none" ? physicalToPixels(printJob.cutPath.stroke, printJob.cutPath.unit, targetPpi) : 0;

      for (const sheet of layout.sheets) {
        throwIfAborted(signal, `antes de componer la hoja ${sheetIndex + 1}/${totalSheets}`);

        const estimate = estimateMemoryBytes(
          { canvasWidthPx: sheetWidthPx, canvasHeightPx: sheetHeightPx, simultaneousPages: 1, cachedImageBytes: cachedPieceBytes + imageCache.totalBytes() },
          memoryBudgetBytes ?? DEFAULT_MEMORY_BUDGET_BYTES,
        );
        if (!estimate.withinBudget) {
          throw new PrintEngineError(
            "memory-budget-exceeded",
            `El tamaño de la hoja (${sheetWidthPx}×${sheetHeightPx}px a ${targetPpi} PPI) excede el presupuesto de memoria seguro.`,
          );
        }

        const { canvas, ctx } = createBlankCanvas(sheetWidthPx, sheetHeightPx);

        for (const piece of sheet.pieces) {
          const bleedTopLeftX = piece.footprintPosition.x + layout.footprint.contentOffset.x;
          const bleedTopLeftY = piece.footprintPosition.y + layout.footprint.contentOffset.y;
          const pieceOriginRasterPx = {
            x: Math.round(physicalToPixels(bleedTopLeftX, layout.unit, targetPpi)),
            y: Math.round(physicalToPixels(bleedTopLeftY, layout.unit, targetPpi)),
          };
          ctx.drawImage(rendered.canvas, pieceOriginRasterPx.x, pieceOriginRasterPx.y, rendered.widthPx, rendered.heightPx);

          if (includePerPieceMarks) {
            for (const mark of placedCropMarksToRaster(perPieceMarkSegments, piece.footprintPosition, layout.unit, targetPpi)) {
              drawLineSegmentOnCanvas(ctx, mark);
            }
          }

          if (baseCutPathSegments) {
            const segments = cutPathSegmentsToRaster(baseCutPathSegments, canonicalScale, contentOffsetCanonical, pieceOriginRasterPx);
            drawPathSegmentsOnCanvas(ctx, segments, cutPathStrokeWidthPx, printJob.cutPath.color);
          }
        }

        for (const mark of perSheetMarkOverlays) {
          drawLineSegmentOnCanvas(ctx, mark);
        }

        throwIfAborted(signal, `antes de codificar la hoja ${sheetIndex + 1}/${totalSheets}`);
        emitProgress(onProgress, { stage: "encoding-page", pageIndex: sheetIndex, pageCount: totalSheets });

        const blob = await canvasToPngBlob(canvas);
        if (!blob) {
          throw new PrintEngineError("raster-encoding-failed", `No se pudo codificar la hoja ${sheetIndex + 1} como PNG a ${targetPpi} PPI.`);
        }
        throwIfAborted(signal, `después de codificar la hoja ${sheetIndex + 1}/${totalSheets}`);

        const filename = buildPrintFilename({
          projectName,
          profile: printJob.profile,
          pageIndex: sheetIndex + 1,
          pageCount: totalSheets,
          label: "sheet",
          date: dateIso,
          extension: "png",
        });

        results.push({ pageId: layout.pageId, sheetIndex: sheet.sheetIndex, filename, blob, widthPx: sheetWidthPx, heightPx: sheetHeightPx });
        sheetIndex += 1;
      }
    }

    emitProgress(onProgress, { stage: "finalizing" });
    emitProgress(onProgress, { stage: "completed" });

    return { format: "png", sheets: results, warnings: preflight.issues };
  } finally {
    imageCache.dispose();
    pieceCache.dispose();
  }
}
