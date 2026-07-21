import type { Unit } from "@impulso/document-schema";
import { computeBoxes } from "../boxes.js";
import { convertUnit } from "../units.js";
import type { ImpositionMarksMode, PrintJob } from "../types.js";

/**
 * Footprint físico de UNA pieza dentro de una hoja impuesta (Fase 9.4,
 * sección 8) — cuánto espacio ocupa realmente en una celda del grid, y
 * dónde dentro de ese espacio empieza el contenido rasterizable/
 * incrustable (el `BleedBox`). Reutiliza `computeBoxes` (Fase 9.1/9.3) sin
 * duplicar su matemática — nunca una segunda implementación de "cuánto
 * espacio necesita el bleed/las marcas".
 */
export interface PieceFootprint {
  width: number;
  height: number;
  unit: Unit;
  /** Offset del `BleedBox` (lo que se rasteriza/incrusta como contenido)
   * respecto a la esquina superior-izquierda de ESTE footprint — `{0,0}`
   * cuando el footprint ES el `BleedBox` (`marksMode` `"none"`/
   * `"per-sheet"`); mayor que cero cuando el footprint incluye espacio de
   * marcas por pieza (`"per-piece"`). Mismo `unit` que el resto. */
  contentOffset: { x: number; y: number };
  /** Tamaño físico del `BleedBox` en sí — siempre `<= width/height`. */
  bleedWidth: number;
  bleedHeight: number;
}

/**
 * `marksMode` decide si el footprint incluye espacio de marcas
 * (`"per-piece"`) o es exactamente el `BleedBox` (`"none"`/`"per-sheet"`
 * — las marcas por hoja viven en el perímetro del área útil general,
 * nunca en el footprint de cada pieza individual, sección 7/16). El
 * `printJob.cropMarks` original SIGUE siendo la fuente de `length`/
 * `offset`/`strokeWidth`/`color` (el "cómo se ven") — `marksMode` de la
 * imposición decide únicamente el "dónde" cuando `imposition.mode ===
 * "grid"`, reemplazando a `printJob.cropMarks.enabled` como autoridad.
 */
export function computePieceFootprint(printJob: PrintJob, marksMode: ImpositionMarksMode): PieceFootprint {
  const includeMarkSpace = marksMode === "per-piece";
  const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, { ...printJob.cropMarks, enabled: includeMarkSpace });

  if (!includeMarkSpace) {
    return { width: boxes.bleed.width, height: boxes.bleed.height, unit: boxes.bleed.unit, contentOffset: { x: 0, y: 0 }, bleedWidth: boxes.bleed.width, bleedHeight: boxes.bleed.height };
  }

  return {
    width: boxes.media.width,
    height: boxes.media.height,
    unit: boxes.media.unit,
    contentOffset: boxes.bleedOffsetWithinMedia,
    bleedWidth: boxes.bleed.width,
    bleedHeight: boxes.bleed.height,
  };
}

/** Convierte un `PieceFootprint` completo a otra unidad física — usado
 * para normalizar la pieza (declarada en `printJob.dimensions.unit`) al
 * espacio canónico de la hoja (`imposition.sheet.unit`), que puede ser
 * distinto (sección 2 de la revisión previa: "normalizarse a un espacio
 * físico canónico claramente documentado"). */
export function convertPieceFootprint(footprint: PieceFootprint, toUnit: Unit): PieceFootprint {
  if (footprint.unit === toUnit) return footprint;
  return {
    width: convertUnit(footprint.width, footprint.unit, toUnit),
    height: convertUnit(footprint.height, footprint.unit, toUnit),
    unit: toUnit,
    contentOffset: {
      x: convertUnit(footprint.contentOffset.x, footprint.unit, toUnit),
      y: convertUnit(footprint.contentOffset.y, footprint.unit, toUnit),
    },
    bleedWidth: convertUnit(footprint.bleedWidth, footprint.unit, toUnit),
    bleedHeight: convertUnit(footprint.bleedHeight, footprint.unit, toUnit),
  };
}
