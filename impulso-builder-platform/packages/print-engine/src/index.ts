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
  type ImpositionSpec,
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

// Backend PDF — interfaz encapsulada (sin tipos de pdf-lib) + implementación por defecto.
export type { PdfBackend, PdfBackendDocument, PdfBackendCreateDocumentOptions, AddRasterPageOptions, PdfBoxPt } from "./pdf/pdfBackend.js";
export { pdfLibBackend } from "./pdf/pdfLibBackend.js";
export { computePdfPageBoxes, type PdfPageBoxes } from "./pdf/pageBoxes.js";
