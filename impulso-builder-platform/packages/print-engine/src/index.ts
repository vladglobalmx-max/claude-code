// Unidades y resolución (ver ADR de Fase 9.1).
export {
  unitToPoints,
  pointsToUnit,
  physicalToPixels,
  pixelsToPhysical,
  pixelRatioForPpi,
  convertUnit,
  mmToIn,
  inToMm,
  mmToPt,
  ptToMm,
  inToPt,
  ptToIn,
} from "./units.js";

// Boxes (trim/bleed/safe/media).
export { computeBoxes, cropMarkStartDistance, type PrintBoxes } from "./boxes.js";

// Print Job.
export { createPrintJob, type CreatePrintJobOptions, type CreatePrintJobOverrides } from "./printJob.js";
export {
  PRINT_JOB_SCHEMA_VERSION,
  type PrintJob,
  type PhysicalSize,
  type BleedSpec,
  type SafeAreaSpec,
  type CropMarksSpec,
  type CutPathSpec,
  type CutPathMode,
  type CutPathSource,
  type ImpositionSpec,
  type GridImpositionSpec,
  type ImpositionAlignment,
  type ImpositionMarksMode,
  type ImpositionPlacementMode,
  type PrintOutputFormat,
  type PrintProfileId,
} from "./types.js";

// Perfiles base.
export { PRINT_PROFILES, type PrintProfileDefaults } from "./profiles.js";

// Naming determinista.
export { buildPrintFilename, type PrintFilenameOptions } from "./naming.js";

// Estimación de memoria.
export {
  estimateMemoryBytes,
  DEFAULT_MEMORY_BUDGET_BYTES,
  MEMORY_OVERHEAD_FACTOR,
  type MemoryEstimateInput,
  type MemoryEstimate,
} from "./memory.js";

// Preflight.
export { runPreflight, type RunPreflightOptions } from "./preflight/runPreflight.js";
export type { PreflightIssue, PreflightResult, PreflightSeverity, PreflightCode } from "./preflight/types.js";
export { browserFontChecker, type FontChecker, type FontAvailability } from "./preflight/fonts.js";
export { browserImageDimensionsProbe, type ImageDimensionsProbe } from "./preflight/imageProbe.js";

// Errores tipados y progreso por etapas (Fase 9.2, ver ADR-0022).
export { PrintEngineError, type PrintEngineErrorCode } from "./errors.js";
export type { PrintExportStage, PrintExportProgressEvent, PrintExportProgressCallback } from "./progress.js";

// Filtro de objects del raster (ej. excluir un die-line del contenido).
export { defaultShouldRenderObject, combineShouldRenderObject, type ShouldRenderObject } from "./raster/objectFilters.js";

// Geometría de raster (px canónico -> raster físico, con sangrado).
export { computeCanonicalPageGeometry, type CanonicalPageGeometry } from "./raster/coordinates.js";

// Cache de imágenes de una exportación (assets decodificados una sola vez).
export { createAssetImageCache, type AssetImageCache } from "./raster/assetImageCache.js";

// Pipeline de raster de impresión.
export { renderPrintPage, type RenderPrintPageOptions, type RenderedPrintPage } from "./raster/renderPrintPage.js";
export { renderPrintJob, type RenderPrintJobOptions, type RenderPrintJobResult } from "./raster/renderPrintJob.js";

// Exportación física.
export { exportPrintJobToPng, type ExportPrintJobToPngOptions, type ExportPrintJobToPngResult, type PrintPngPageResult } from "./raster/exportPrintJobToPng.js";
export { exportPrintJobToPdf, type ExportPrintJobToPdfOptions, type ExportPrintJobToPdfResult } from "./raster/exportPrintJobToPdf.js";
export { exportImpositionToPdf, type ExportImpositionToPdfOptions, type ExportImpositionToPdfResult } from "./raster/exportImpositionToPdf.js";
export { exportImpositionToPng, type ExportImpositionToPngOptions, type ExportImpositionToPngResult, type ImposedPngSheetResult } from "./raster/exportImpositionToPng.js";

// Backend PDF — interfaz encapsulada (sin tipos de pdf-lib) + implementación por defecto.
export type {
  PdfBackend,
  PdfBackendDocument,
  PdfBackendCreateDocumentOptions,
  AddRasterPageOptions,
  AddImposedSheetPageOptions,
  PdfBoxPt,
  PdfPointPt,
  PdfLineOverlay,
  PdfPathOverlay,
  PdfEmbeddedImage,
  PlacedImage,
} from "./pdf/pdfBackend.js";
export { pdfLibBackend } from "./pdf/pdfLibBackend.js";
export { computePdfPageBoxes, type PdfPageBoxes } from "./pdf/pageBoxes.js";
export { parseHexColor, type RgbColor } from "./pdf/color.js";
export { cropMarkSegmentToPdf, canonicalPointToPdfPoint, cutPathSegmentsToPdf } from "./pdf/canonicalToPdfPoints.js";

// Marcas de corte — geometría pura (Fase 9.3, ver ADR-0023).
export { computeCropMarksGeometry, type CropMarkSegment } from "./marks/cropMarksGeometry.js";

// Safe area — rectángulo canónico + chequeo de invasión por object (Fase 9.3).
export { computeSafeAreaCanonicalRect, type SafeAreaCanonicalRect } from "./safearea/safeAreaRect.js";
export { checkSafeAreaInvasions, type SafeAreaInvasion } from "./safearea/safeAreaCheck.js";

// Cut path — afín 2D puro, recorrido de objects, detección de die-line, normalización y offset (Fase 9.3).
export {
  IDENTITY_AFFINE,
  applyAffine,
  affineFromTransform,
  composeAffine,
  composeAncestorChain,
  isSimilarityTransform,
  decomposeSimilarity,
  pivotOf,
  type Affine2D,
  type SimilarityDecomposition,
} from "./cutpath/affine.js";
export { traverseObjects, findObjectById, type TraversedObject } from "./cutpath/objectTraversal.js";
export { resolveDieLineSource, type DieLineResolution } from "./cutpath/dieLineDetection.js";
export {
  normalizeCutGeometry,
  transformPathSegments,
  type CutGeometry,
  type RectangleCutGeometry,
  type EllipseCutGeometry,
  type ClosedPathCutGeometry,
  type CutGeometryResult,
  type CutGeometryFailureReason,
} from "./cutpath/cutGeometry.js";
export { applyCutGeometryOffset, type CutGeometryOffsetResult } from "./cutpath/cutGeometryOffset.js";
export { cutGeometryToPathSegments } from "./cutpath/cutGeometryToSegments.js";

// Conversión de geometría canónica a puntos de raster, y composición sobre Canvas2D (Fase 9.3).
export {
  cropMarkSegmentToRaster,
  canonicalPointToRasterPoint,
  cutPathSegmentsToRaster,
  type RasterLineSegment,
} from "./raster/canonicalToRasterPoints.js";
export {
  drawLineSegmentOnCanvas,
  drawPathSegmentsOnCanvas,
  createMediaCanvasWithContent,
  createBlankCanvas,
} from "./raster/composeCanvasOverlays.js";

// Imposición — geometría pura (Fase 9.4, ver ADR de imposición).
export { computePieceFootprint, convertPieceFootprint, type PieceFootprint } from "./imposition/pieceFootprint.js";
export { computeSheetPhysicalBoxes, type SheetPhysicalBoxes } from "./imposition/sheetGeometry.js";
export {
  computeGridCapacity,
  type GridCapacity,
  type GridCapacityResult,
  type GridCapacityFailureReason,
} from "./imposition/gridCapacity.js";
export { computeAlignmentOffset } from "./imposition/alignment.js";
export {
  computeImpositionLayout,
  MAX_IMPOSITION_SHEETS,
  MAX_IMPOSITION_PIECES,
  type ImpositionLayout,
  type ImpositionLayoutResult,
  type ImpositionFitFailureReason,
  type PlacedPiece,
  type PlacedSheet,
} from "./imposition/impositionLayout.js";
export { validateImpositionLayoutGeometry, type LayoutGeometryIssue } from "./imposition/validateLayoutGeometry.js";
export {
  createPieceRasterCache,
  pieceRasterCacheKey,
  type PieceRasterCache,
  type RenderPieceOptions,
} from "./raster/pieceRasterCache.js";
