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
