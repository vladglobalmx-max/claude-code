import type { Unit } from "@impulso/document-schema";
import type { GridImpositionSpec } from "../types.js";

export interface SheetPhysicalBoxes {
  width: number;
  height: number;
  unit: Unit;
  /** Rect del área útil (tras aplicar márgenes) en espacio físico de
   * HOJA — origen en la esquina superior-izquierda de la hoja completa,
   * y-down. Es geometría de preview/Preflight ÚNICAMENTE — nunca un box
   * real del PDF (que solo tiene Media/Crop/Bleed/Trim, sección 6: "no
   * inventar un 5º box no estándar"). */
  usefulArea: { x: number; y: number; width: number; height: number };
}

/**
 * Boxes físicos de UNA hoja de imposición (Fase 9.4, sección 5-6) —
 * `orientation: "landscape"` intercambia las dimensiones DECLARADAS de
 * `sheet` (nunca rota contenido, nunca modifica el `Project`, sección 5).
 * Los márgenes reducen el área útil — nunca deben confundirse con el
 * bleed de la pieza (sección 10).
 */
export function computeSheetPhysicalBoxes(imposition: GridImpositionSpec): SheetPhysicalBoxes {
  const width = imposition.orientation === "landscape" ? imposition.sheet.height : imposition.sheet.width;
  const height = imposition.orientation === "landscape" ? imposition.sheet.width : imposition.sheet.height;
  const unit = imposition.sheet.unit;

  const usefulWidth = Math.max(0, width - imposition.marginLeft - imposition.marginRight);
  const usefulHeight = Math.max(0, height - imposition.marginTop - imposition.marginBottom);

  return {
    width,
    height,
    unit,
    usefulArea: { x: imposition.marginLeft, y: imposition.marginTop, width: usefulWidth, height: usefulHeight },
  };
}
