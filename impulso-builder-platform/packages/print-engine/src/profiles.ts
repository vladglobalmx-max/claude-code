import type {
  BleedSpec,
  CropMarksSpec,
  CutPathSpec,
  ImpositionSpec,
  PrintJob,
  PrintOutputFormat,
  PrintProfileId,
  SafeAreaSpec,
} from "./types.js";

/**
 * Perfiles base (sección 12 del enunciado) — 4 presets, nombres humanos,
 * sin jerga técnica en el nombre visible. Cada uno rellena los valores por
 * defecto de un `PrintJob`; el usuario puede modificarlos después (nunca
 * ocultos: `createPrintJob` siempre expone el resultado completo, nunca un
 * subconjunto "avanzado" invisible).
 */
export interface PrintProfileDefaults {
  id: PrintProfileId;
  /** Nombre comprensible para un usuario no técnico. */
  name: string;
  description: string;
  output: PrintOutputFormat;
  resolution: { targetPpi: number };
  bleed: BleedSpec;
  safeArea: SafeAreaSpec;
  cropMarks: CropMarksSpec;
  cutPath: CutPathSpec;
  background: PrintJob["background"];
  imposition: ImpositionSpec;
  /** Política cuando `cutPath.offset !== 0` sobre un `PathObject` cerrado
   * (Fase 9.3, sección 14) — no hay una solución geométrica de offset
   * confiable para curvas arbitrarias sin una dependencia pesada nueva
   * (deliberadamente no agregada). `"warn"` es el default de los perfiles
   * de producción: exporta el path SIN offset pero deja constancia. */
  offsetUnsupportedPolicy: "block" | "warn" | "use-original";
}

const NO_BLEED: BleedSpec = { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" };
const NO_SAFE_AREA: SafeAreaSpec = { enabled: false, margin: 0, unit: "mm" };
const NO_CROP_MARKS: CropMarksSpec = { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" };
const NO_CUT_PATH: CutPathSpec = {
  mode: "none",
  source: { type: "auto" },
  offset: 0,
  unit: "mm",
  stroke: 0,
  color: "#ff00ff",
  logicalLayerName: "CutContour",
};
const NO_IMPOSITION: ImpositionSpec = {
  enabled: false,
  sheet: { width: 0, height: 0, unit: "mm" },
  columns: 1,
  rows: 1,
  gapX: 0,
  gapY: 0,
  marginX: 0,
  marginY: 0,
  orientation: "portrait",
};

/** Bleed de 3mm — el preset sugerido más común para impresión comercial
 * pequeña (sección 7 del enunciado). */
const STANDARD_BLEED: BleedSpec = { top: 3, right: 3, bottom: 3, left: 3, unit: "mm" };
const STANDARD_SAFE_AREA: SafeAreaSpec = { enabled: true, margin: 3, unit: "mm" };
const STANDARD_CROP_MARKS: CropMarksSpec = { enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" };
const STANDARD_CUT_PATH: CutPathSpec = {
  mode: "die-cut",
  source: { type: "auto" },
  offset: 0,
  unit: "mm",
  stroke: 0.25,
  color: "#ff00ff",
  logicalLayerName: "DieCut",
};

export const PRINT_PROFILES: Record<PrintProfileId, PrintProfileDefaults> = {
  "digital-png": {
    id: "digital-png",
    name: "Digital PNG",
    description: "Imagen para pantalla o uso digital — sin sangrado ni marcas de corte.",
    output: "png",
    resolution: { targetPpi: 96 },
    bleed: NO_BLEED,
    safeArea: NO_SAFE_AREA,
    cropMarks: NO_CROP_MARKS,
    cutPath: NO_CUT_PATH,
    background: { type: "transparent" },
    imposition: NO_IMPOSITION,
    offsetUnsupportedPolicy: "warn",
  },
  "print-pdf": {
    id: "print-pdf",
    name: "Print PDF",
    description: "PDF aplanado de alta resolución, listo para producción — tamaño físico, sangrado y marcas de corte.",
    output: "pdf",
    resolution: { targetPpi: 300 },
    bleed: STANDARD_BLEED,
    safeArea: STANDARD_SAFE_AREA,
    cropMarks: STANDARD_CROP_MARKS,
    cutPath: NO_CUT_PATH,
    background: { type: "solid", color: "#ffffff" },
    imposition: NO_IMPOSITION,
    offsetUnsupportedPolicy: "warn",
  },
  "sticker-sheet": {
    id: "sticker-sheet",
    name: "Sticker Sheet",
    description: "Varias copias del diseño en una sola hoja, con línea de corte y sangrado.",
    output: "pdf",
    resolution: { targetPpi: 300 },
    bleed: STANDARD_BLEED,
    safeArea: STANDARD_SAFE_AREA,
    cropMarks: STANDARD_CROP_MARKS,
    cutPath: STANDARD_CUT_PATH,
    background: { type: "solid", color: "#ffffff" },
    imposition: {
      enabled: true,
      sheet: { width: 210, height: 297, unit: "mm" },
      columns: 1,
      rows: 1,
      gapX: 5,
      gapY: 5,
      marginX: 10,
      marginY: 10,
      orientation: "portrait",
    },
    offsetUnsupportedPolicy: "warn",
  },
  "web-preview": {
    id: "web-preview",
    name: "Web Preview",
    description: "Optimizado para mostrarse en pantalla — resolución baja, archivo liviano.",
    output: "png",
    resolution: { targetPpi: 72 },
    bleed: NO_BLEED,
    safeArea: NO_SAFE_AREA,
    cropMarks: NO_CROP_MARKS,
    cutPath: NO_CUT_PATH,
    background: { type: "solid", color: "#ffffff" },
    imposition: NO_IMPOSITION,
    offsetUnsupportedPolicy: "warn",
  },
};
