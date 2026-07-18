// API pública
export { exportProject } from "./exportProject.js";
export type {
  ExportAssetResolver,
  ExportBackground,
  ExportScale,
  PngExportOptions,
  SvgExportOptions,
  ExportOptions,
  ExportWarningCode,
  ExportWarning,
  ExportResult,
} from "./types.js";
export { ExportError } from "./errors.js";
export type { ExportErrorCode } from "./errors.js";

// Núcleo SVG (independiente de Konva) — expuesto por si un caller necesita
// solo el string SVG sin pasar por `exportProject` (ej. una vista previa).
export { buildSvgDocument } from "./svg/buildSvgDocument.js";
export type { BuildSvgDocumentOptions, BuildSvgDocumentResult } from "./svg/buildSvgDocument.js";

// Adaptador PNG (headless, vía @impulso/renderer-konva) — ver ADR-0012.
export { rasterizeProjectToPng } from "./png/rasterizeProjectToPng.js";
export type { RasterizePngResult } from "./png/rasterizeProjectToPng.js";

// Adaptador de navegador — DOM-only, separado del núcleo.
export { triggerBrowserDownload } from "./browser/download.js";
export { sanitizeFilename } from "./browser/filename.js";
