import type { PageId, Unit } from "@impulso/document-schema";
import type { PrintJob } from "../types.js";
import { computePieceFootprint, convertPieceFootprint, type PieceFootprint } from "./pieceFootprint.js";
import { computeSheetPhysicalBoxes, type SheetPhysicalBoxes } from "./sheetGeometry.js";
import { computeGridCapacity, type GridCapacityFailureReason } from "./gridCapacity.js";
import { computeAlignmentOffset } from "./alignment.js";

/** Límites de producto documentados (Fase 9.4, sección 39) — no
 * arbitrarios: un orden de magnitud por encima del rango verificado en
 * performance (sección 38: 500 piezas totales, 10 hojas), suficiente
 * margen para uso real sin arriesgar que una `quantity` mal tipeada
 * (ej. un cero de más) congele el navegador construyendo miles de
 * posiciones. */
export const MAX_IMPOSITION_SHEETS = 200;
export const MAX_IMPOSITION_PIECES = 2000;

export type ImpositionFitFailureReason = "sheet_size_invalid" | "sheet_area_collapsed" | "quantity_invalid" | "excessive_sheet_count" | "excessive_piece_count" | GridCapacityFailureReason;

export interface PlacedPiece {
  pageId: PageId;
  sheetIndex: number;
  /** Índice GLOBAL de copia (0-based), estable y determinista — nunca se
   * renumera al cambiar de hoja (sección 4: "copias numeradas de forma
   * estable"). */
  copyIndex: number;
  row: number;
  column: number;
  /** Esquina superior-izquierda del footprint de ESTA pieza, en espacio
   * físico de HOJA (origen: esquina superior-izquierda de la hoja
   * completa, y-down) — mismo `unit` que `ImpositionLayout.unit`. */
  footprintPosition: { x: number; y: number };
}

export interface PlacedSheet {
  sheetIndex: number;
  pieces: PlacedPiece[];
}

export interface ImpositionLayout {
  pageId: PageId;
  /** Unidad física CANÓNICA de todo este layout — la de
   * `imposition.sheet.unit` (sección 2 de la revisión previa); el
   * footprint de la pieza ya viene convertido a esta unidad. */
  unit: Unit;
  sheet: SheetPhysicalBoxes;
  footprint: PieceFootprint;
  rows: number;
  columns: number;
  capacityPerSheet: number;
  quantityRequested: number;
  sheetCount: number;
  /** Piezas colocadas en la ÚLTIMA hoja — puede ser menor a
   * `capacityPerSheet` (sección 6: "la última hoja puede quedar
   * parcialmente ocupada"). */
  lastSheetPieceCount: number;
  /** Celdas vacías en la última hoja — `capacityPerSheet -
   * lastSheetPieceCount`, para que la UI muestre "la última hoja tendrá Z
   * piezas" sin recalcularlo. */
  lastSheetEmptyCells: number;
  sheets: PlacedSheet[];
}

export type ImpositionLayoutResult = { ok: true; layout: ImpositionLayout } | { ok: false; reason: ImpositionFitFailureReason };

/**
 * Geometría pura de imposición (Fase 9.4, sección 4) — sin Canvas, PDF,
 * Konva ni UI. Orden determinista obligatorio (sección 4): hojas en
 * orden, dentro de cada hoja filas de arriba hacia abajo, columnas de
 * izquierda a derecha, copias numeradas de forma estable — todo eso vive
 * en el doble `for` de abajo, nunca en un `Set`/`Map` sin orden garantizado.
 *
 * Solo aplica a `printJob.imposition.mode === "grid"` — llamarlo con
 * `"single"` es un error de programación (el caller debe verificar el
 * modo antes), no un caso de negocio a reportar como `ImpositionLayoutResult`.
 */
export function computeImpositionLayout(printJob: PrintJob, pageId: PageId): ImpositionLayoutResult {
  const imposition = printJob.imposition;
  if (imposition.mode !== "grid") {
    throw new Error("computeImpositionLayout solo aplica cuando printJob.imposition.mode === 'grid'");
  }

  if (!Number.isFinite(imposition.sheet.width) || !Number.isFinite(imposition.sheet.height) || imposition.sheet.width <= 0 || imposition.sheet.height <= 0) {
    return { ok: false, reason: "sheet_size_invalid" };
  }
  if (!Number.isInteger(imposition.quantity) || imposition.quantity <= 0) {
    return { ok: false, reason: "quantity_invalid" };
  }
  if (imposition.quantity > MAX_IMPOSITION_PIECES) {
    return { ok: false, reason: "excessive_piece_count" };
  }

  const sheet = computeSheetPhysicalBoxes(imposition);
  if (sheet.usefulArea.width <= 0 || sheet.usefulArea.height <= 0) {
    return { ok: false, reason: "sheet_area_collapsed" };
  }

  const footprintRaw = computePieceFootprint(printJob, imposition.marksMode);
  const footprint = convertPieceFootprint(footprintRaw, sheet.unit);

  const capacityResult = computeGridCapacity(sheet, footprint.width, footprint.height, imposition);
  if (!capacityResult.ok) return capacityResult;
  const { rows, columns, capacity } = capacityResult.capacity;

  const sheetCount = Math.ceil(imposition.quantity / capacity);
  if (sheetCount > MAX_IMPOSITION_SHEETS) {
    return { ok: false, reason: "excessive_sheet_count" };
  }

  const gridWidth = columns * footprint.width + (columns - 1) * imposition.gapX;
  const gridHeight = rows * footprint.height + (rows - 1) * imposition.gapY;
  const alignOffset = computeAlignmentOffset(imposition.alignment, sheet.usefulArea.width, sheet.usefulArea.height, gridWidth, gridHeight);

  const sheets: PlacedSheet[] = [];
  let remaining = imposition.quantity;
  let lastSheetPieceCount = 0;

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
    const piecesOnThisSheet = Math.min(remaining, capacity);
    lastSheetPieceCount = piecesOnThisSheet;
    const pieces: PlacedPiece[] = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const indexInSheet = row * columns + column;
        if (indexInSheet >= piecesOnThisSheet) continue; // celda vacía — nunca se rellena con una copia fantasma.
        pieces.push({
          pageId,
          sheetIndex,
          copyIndex: sheetIndex * capacity + indexInSheet,
          row,
          column,
          footprintPosition: {
            x: sheet.usefulArea.x + alignOffset.x + column * (footprint.width + imposition.gapX),
            y: sheet.usefulArea.y + alignOffset.y + row * (footprint.height + imposition.gapY),
          },
        });
      }
    }

    sheets.push({ sheetIndex, pieces });
    remaining -= piecesOnThisSheet;
  }

  return {
    ok: true,
    layout: {
      pageId,
      unit: sheet.unit,
      sheet,
      footprint,
      rows,
      columns,
      capacityPerSheet: capacity,
      quantityRequested: imposition.quantity,
      sheetCount,
      lastSheetPieceCount,
      lastSheetEmptyCells: capacity - lastSheetPieceCount,
      sheets,
    },
  };
}
