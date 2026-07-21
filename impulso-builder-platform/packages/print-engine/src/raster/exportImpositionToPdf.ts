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
import { convertUnit, unitToPoints } from "../units.js";
import type { PrintJob } from "../types.js";
import type { PdfBackend, PdfBoxPt, PdfLineOverlay, PdfPathOverlay, PlacedImage } from "../pdf/pdfBackend.js";
import { pdfLibBackend } from "../pdf/pdfLibBackend.js";
import { cropMarkSegmentToPdf, cutPathSegmentsToPdf } from "../pdf/canonicalToPdfPoints.js";
import { computeCropMarksGeometry, type CropMarkSegment } from "../marks/cropMarksGeometry.js";
import { resolveDieLineSource } from "../cutpath/dieLineDetection.js";
import { normalizeCutGeometry } from "../cutpath/cutGeometry.js";
import { applyCutGeometryOffset } from "../cutpath/cutGeometryOffset.js";
import { cutGeometryToPathSegments } from "../cutpath/cutGeometryToSegments.js";
import { computeImpositionLayout, type ImpositionLayout, type PlacedPiece } from "../imposition/impositionLayout.js";
import { createAssetImageCache } from "./assetImageCache.js";
import { createPieceRasterCache } from "./pieceRasterCache.js";
import type { ShouldRenderObject } from "./objectFilters.js";

export interface ExportImpositionToPdfOptions {
  project: Project;
  /** `printJob.imposition.mode` DEBE ser `"grid"` — llamar a esta función
   * con `"single"` es un error de programación (el caller decide qué
   * exportador usar según el modo, igual que `computeImpositionLayout`). */
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
  /** Inyectable para tests de dominio que nunca necesitan conocer
   * `pdf-lib` — por defecto, `pdfLibBackend` (el único backend real). */
  backend?: PdfBackend;
}

export interface ExportImpositionToPdfResult {
  format: "pdf";
  filename: string;
  blob: Blob;
  /** Total de hojas físicas generadas — suma de `sheetCount` de la
   * imposición de cada página del job (sección 24: cada página es un
   * grupo de hojas independiente). */
  sheetCount: number;
  /** Total de piezas colocadas en todas las hojas — nunca cuenta celdas
   * vacías (sección 6). */
  pieceCount: number;
  warnings: PreflightIssue[];
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function canvasToPngBytes(canvas: HTMLCanvasElement, pageId: PageId): Promise<Uint8Array> {
  const blob = await canvasToPngBlob(canvas);
  if (!blob) {
    throw new PrintEngineError("raster-encoding-failed", `No se pudo codificar la pieza de la página "${pageId}" como PNG para incrustar en el PDF.`);
  }
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Geometría (en puntos PDF) del raster de UNA pieza colocada — cubre
 * exactamente su `BleedBox`, posicionado dentro del footprint por
 * `footprint.contentOffset` (ya en `layout.unit`, sección 8) — nunca se
 * escala, solo se desplaza (mismo principio que `exportPrintJobToPdf.ts`
 * a nivel de página completa).
 */
function computePieceImageGeometryPt(layout: ImpositionLayout, piece: PlacedPiece, sheetHeightPt: number) {
  const unit = layout.unit;
  const footprint = layout.footprint;
  const bleedTopLeftX = piece.footprintPosition.x + footprint.contentOffset.x;
  const bleedTopLeftY = piece.footprintPosition.y + footprint.contentOffset.y;
  const imageWidthPt = unitToPoints(footprint.bleedWidth, unit);
  const imageHeightPt = unitToPoints(footprint.bleedHeight, unit);
  const imageXPt = unitToPoints(bleedTopLeftX, unit);
  const imageYPt = sheetHeightPt - unitToPoints(bleedTopLeftY, unit) - imageHeightPt;
  return { imageXPt, imageYPt, imageWidthPt, imageHeightPt };
}

/**
 * `TrimBox` (en puntos PDF) de UNA pieza colocada — necesario únicamente
 * como referencia para traducir el cut path ya normalizado/offseteado de
 * esa página (sección 17: "nunca re-derivar por copia", solo trasladar).
 * `trimOffsetInFootprint`/`trimSize` son constantes para todo el job (no
 * dependen de la copia ni de la hoja) — se calculan una sola vez fuera de
 * este helper y se pasan ya resueltos.
 */
function computePieceTrimBoxPt(
  footprintPosition: { x: number; y: number },
  trimOffsetInFootprint: { x: number; y: number },
  trimSize: { width: number; height: number },
  unit: Unit,
  sheetHeightPt: number,
): PdfBoxPt {
  const trimTopLeftX = footprintPosition.x + trimOffsetInFootprint.x;
  const trimTopLeftY = footprintPosition.y + trimOffsetInFootprint.y;
  const widthPt = unitToPoints(trimSize.width, unit);
  const heightPt = unitToPoints(trimSize.height, unit);
  const xPt = unitToPoints(trimTopLeftX, unit);
  const yPt = sheetHeightPt - unitToPoints(trimTopLeftY, unit) - heightPt;
  return { x: xPt, y: yPt, width: widthPt, height: heightPt };
}

/**
 * Cut path vectorial BASE de una página (canónico, ya normalizado y
 * offseteado) — se calcula UNA sola vez por página de origen, nunca por
 * copia colocada (sección 17). `undefined` si `cutPath.mode === "none"`.
 * Idéntico en espíritu al homónimo de `exportPrintJobToPdf.ts` — los
 * `PrintEngineError` lanzados aquí son DEFENSIVOS ("Preflight debería
 * haber bloqueado esto antes"), no una segunda validación de negocio.
 */
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

/** Traduce el cut path BASE (ya normalizado, en px canónico relativo al
 * TrimBox de origen) a la posición de UNA copia colocada — solo
 * aritmética (el `trimBoxPt` de esa copia), nunca vuelve a normalizar ni
 * a offsetear la geometría. */
function placedCutPathToPdf(baseSegments: PathSegment[], trimBoxPt: PdfBoxPt, printJob: PrintJob): PdfPathOverlay {
  return {
    segments: cutPathSegmentsToPdf(baseSegments, trimBoxPt),
    strokeWidthPt: unitToPoints(printJob.cutPath.stroke, printJob.cutPath.unit),
    colorHex: printJob.cutPath.color,
  };
}

/** Las 8 marcas de corte de UNA pieza (relativas al origen de su propio
 * footprint, en `printJob.dimensions.unit`) — `[]` si `marksMode !==
 * "per-piece"`. Página-independiente (depende solo de dims/bleed/
 * cropMarks del job), se calcula una sola vez y se traduce por copia. */
function buildPerPieceCropMarkSegments(printJob: PrintJob, pieceBoxes: PrintBoxes, includePerPiece: boolean): CropMarkSegment[] {
  if (!includePerPiece) return [];
  return computeCropMarksGeometry(pieceBoxes, { ...printJob.cropMarks, enabled: true });
}

/** Traduce las marcas BASE de una pieza (relativas a su footprint) a la
 * posición absoluta de una copia colocada en la hoja, y las convierte a
 * puntos PDF. */
function placedCropMarksToPdf(
  baseSegments: CropMarkSegment[],
  footprintPosition: { x: number; y: number },
  sheetUnit: Unit,
  sheetHeightPt: number,
): PdfLineOverlay[] {
  return baseSegments.map((segment) => {
    const translated: CropMarkSegment = {
      unit: sheetUnit,
      strokeWidth: convertUnit(segment.strokeWidth, segment.unit, sheetUnit),
      color: segment.color,
      from: {
        x: footprintPosition.x + convertUnit(segment.from.x, segment.unit, sheetUnit),
        y: footprintPosition.y + convertUnit(segment.from.y, segment.unit, sheetUnit),
      },
      to: {
        x: footprintPosition.x + convertUnit(segment.to.x, segment.unit, sheetUnit),
        y: footprintPosition.y + convertUnit(segment.to.y, segment.unit, sheetUnit),
      },
    };
    return cropMarkSegmentToPdf(translated, sheetHeightPt);
  });
}

/** `PrintBoxes` sintético para un rectángulo puro (sin bleed ni marcas
 * propias) — únicamente para reutilizar `computeCropMarksGeometry` a
 * nivel de HOJA (marcas `"per-sheet"`), donde el "trim" es el área útil
 * general de la hoja, no la pieza (sección 16: "un contorno de
 * producción, NUNCA una guía de corte individual por pieza"). */
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
 * marcas alrededor del área útil general (`layout.sheet.usefulArea`,
 * después de aplicar márgenes), igual para toda hoja de esta página
 * (sección 16) — se calcula una sola vez por página, se reutiliza en
 * cada hoja de esa página. `[]` si `marksMode !== "per-sheet"`. */
function buildPerSheetCropMarkOverlays(layout: ImpositionLayout, printJob: PrintJob, sheetHeightPt: number): PdfLineOverlay[] {
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
    return cropMarkSegmentToPdf(translated, sheetHeightPt);
  });
}

/**
 * PDF imposicionado de un `PrintJob` con `imposition.mode === "grid"`
 * (Epic 9 / Fase 9.4, ver ADR de imposición) — UN solo archivo, una hoja
 * física por página PDF (multipágina), cada hoja con N copias de la MISMA
 * pieza rasterizada UNA sola vez (`createPieceRasterCache`) y embebida
 * UNA sola vez (`PdfBackend.embedImage`), dibujada N veces vía
 * `addImposedSheetPage` — nunca se re-rasteriza ni se re-embebe por copia
 * (sección 13/15). Marcas de corte y cut path se dibujan DESPUÉS de las
 * imágenes, como vectores reales (mismo orden que `exportPrintJobToPdf.ts`,
 * ADR-0023) — el cut path se normaliza/offsetea UNA sola vez por página de
 * origen y solo se TRASLADA por copia (sección 17). Cada página de
 * `printJob.pageIds` es un grupo de imposición independiente (sección 24)
 * — sus hojas se concatenan en el mismo documento, en el orden de
 * `pageIds`.
 *
 * El backend `pdf-lib` queda completamente aislado detrás de `PdfBackend`
 * — este módulo nunca importa `pdf-lib` directamente.
 */
export async function exportImpositionToPdf(options: ExportImpositionToPdfOptions): Promise<ExportImpositionToPdfResult> {
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

  if (printJob.imposition.mode !== "grid") {
    throw new Error("exportImpositionToPdf solo aplica cuando printJob.imposition.mode === 'grid'");
  }
  const imposition = printJob.imposition;

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

  // Layout de imposición por página — cada una es un grupo de hojas
  // independiente (sección 24). Si alguna no cabe, es DEFENSIVO: la
  // Preflight de imposición (sección 16, aún no conectada en esta fase)
  // debería haber bloqueado esto antes de llegar al exportador.
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
    const nowIso = now();
    const pdfDocument = backend.createDocument({ producer: "Impulso Print Engine", creationDate: new Date(nowIso) });

    // Geometría del footprint de trim (constante para todo el job — no
    // depende de la página de origen ni de la copia, sección 8): dónde
    // cae el TrimBox dentro del footprint, y su tamaño, ya normalizados a
    // `imposition.sheet.unit`.
    const includePerPieceMarks = imposition.marksMode === "per-piece";
    const pieceBoxesUnit = printJob.dimensions.unit;
    const pieceBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, { ...printJob.cropMarks, enabled: includePerPieceMarks });
    const sheetUnit = imposition.sheet.unit;
    const trimOffsetInFootprint = {
      x: convertUnit(pieceBoxes.bleedOffsetWithinMedia.x, pieceBoxesUnit, sheetUnit) + convertUnit(pieceBoxes.trimOffsetWithinBleed.x, pieceBoxesUnit, sheetUnit),
      y: convertUnit(pieceBoxes.bleedOffsetWithinMedia.y, pieceBoxesUnit, sheetUnit) + convertUnit(pieceBoxes.trimOffsetWithinBleed.y, pieceBoxesUnit, sheetUnit),
    };
    const trimSize = {
      width: convertUnit(pieceBoxes.trim.width, pieceBoxesUnit, sheetUnit),
      height: convertUnit(pieceBoxes.trim.height, pieceBoxesUnit, sheetUnit),
    };
    const perPieceMarkSegments = buildPerPieceCropMarkSegments(printJob, pieceBoxes, includePerPieceMarks);

    // Rasteriza y embebe UNA sola vez por página de origen — nunca por
    // copia colocada (sección 13/15).
    const embeddedByPage = new Map<PageId, Awaited<ReturnType<typeof pdfDocument.embedImage>>>();
    const cutPathByPage = new Map<PageId, PathSegment[] | undefined>();

    let renderIndex = 0;
    for (const layout of layouts) {
      throwIfAborted(signal, `antes de rasterizar la pieza de la página "${layout.pageId}"`);
      emitProgress(onProgress, { stage: "rendering-page", pageIndex: renderIndex, pageCount: layouts.length });

      const rendered = await pieceCache.get(layout.pageId, { project, printJob, imageCache, shouldRenderObject, signal });
      throwIfAborted(signal, `después de rasterizar la pieza de la página "${layout.pageId}"`);

      const imageBytes = await canvasToPngBytes(rendered.canvas, layout.pageId);
      const embedded = await pdfDocument.embedImage(imageBytes);
      embeddedByPage.set(layout.pageId, embedded);
      cutPathByPage.set(layout.pageId, buildBaseCutPathSegments(project, layout.pageId, printJob));

      throwIfAborted(signal, `después de embeber la pieza de la página "${layout.pageId}"`);
      renderIndex += 1;
    }

    const totalSheets = layouts.reduce((sum, layout) => sum + layout.sheetCount, 0);
    let sheetIndex = 0;
    let pieceCount = 0;

    for (const layout of layouts) {
      const embedded = embeddedByPage.get(layout.pageId);
      if (!embedded) {
        throw new PrintEngineError("render-failed", `No se encontró la imagen embebida de la página "${layout.pageId}" — inconsistencia interna del exportador.`);
      }
      const baseCutPathSegments = cutPathByPage.get(layout.pageId);
      const sheetWidthPt = unitToPoints(layout.sheet.width, layout.unit);
      const sheetHeightPt = unitToPoints(layout.sheet.height, layout.unit);
      const perSheetMarkOverlays = buildPerSheetCropMarkOverlays(layout, printJob, sheetHeightPt);

      for (const sheet of layout.sheets) {
        throwIfAborted(signal, `antes de ensamblar la hoja ${sheetIndex + 1}/${totalSheets}`);
        emitProgress(onProgress, { stage: "assembling-pdf", pageIndex: sheetIndex, pageCount: totalSheets });

        const images: PlacedImage[] = [];
        const cropMarks: PdfLineOverlay[] = [...perSheetMarkOverlays];
        const cutPaths: PdfPathOverlay[] = [];

        for (const piece of sheet.pieces) {
          pieceCount += 1;
          const { imageXPt, imageYPt, imageWidthPt, imageHeightPt } = computePieceImageGeometryPt(layout, piece, sheetHeightPt);
          images.push({ image: embedded, x: imageXPt, y: imageYPt, widthPt: imageWidthPt, heightPt: imageHeightPt });

          if (includePerPieceMarks) {
            cropMarks.push(...placedCropMarksToPdf(perPieceMarkSegments, piece.footprintPosition, layout.unit, sheetHeightPt));
          }

          if (baseCutPathSegments) {
            const trimBoxPt = computePieceTrimBoxPt(piece.footprintPosition, trimOffsetInFootprint, trimSize, layout.unit, sheetHeightPt);
            cutPaths.push(placedCutPathToPdf(baseCutPathSegments, trimBoxPt, printJob));
          }
        }

        await pdfDocument.addImposedSheetPage({
          mediaWidthPt: sheetWidthPt,
          mediaHeightPt: sheetHeightPt,
          mediaBox: { x: 0, y: 0, width: sheetWidthPt, height: sheetHeightPt },
          images,
          cropMarks,
          cutPaths,
        });

        throwIfAborted(signal, `después de ensamblar la hoja ${sheetIndex + 1}/${totalSheets}`);
        sheetIndex += 1;
      }
    }

    emitProgress(onProgress, { stage: "finalizing" });
    throwIfAborted(signal, "antes de guardar el PDF final (save)");
    const bytes = await pdfDocument.save();
    throwIfAborted(signal, "después de guardar el PDF final, antes de entregar el resultado");
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

    const filename = buildPrintFilename({
      projectName,
      profile: printJob.profile,
      // Un PDF multipágina es UN solo archivo — nunca se numera por hoja
      // (mismo criterio que `exportPrintJobToPdf.ts`).
      pageCount: 1,
      date: nowIso,
      extension: "pdf",
    });

    emitProgress(onProgress, { stage: "completed" });

    return { format: "pdf", filename, blob, sheetCount: totalSheets, pieceCount, warnings: preflight.issues };
  } finally {
    imageCache.dispose();
    pieceCache.dispose();
  }
}
