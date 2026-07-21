import type { GridImpositionSpec } from "../types.js";
import type { SheetPhysicalBoxes } from "./sheetGeometry.js";

export type GridCapacityFailureReason = "grid_rows_invalid" | "grid_columns_invalid" | "piece_does_not_fit" | "fixed_grid_does_not_fit";

export interface GridCapacity {
  rows: number;
  columns: number;
  capacity: number;
}

export type GridCapacityResult = { ok: true; capacity: GridCapacity } | { ok: false; reason: GridCapacityFailureReason };

/** Cuántas piezas de `pieceLength` (con `gap` ENTRE ellas, nunca después
 * de la última) caben en `usefulLength` — la desigualdad clásica de
 * empaquetado en una sola fila/columna: `n×pieceLength + (n-1)×gap <=
 * usefulLength`, despejada para `n`. */
function fitsCount(usefulLength: number, pieceLength: number, gap: number): number {
  if (pieceLength <= 0) return 0;
  return Math.max(0, Math.floor((usefulLength + gap) / (pieceLength + gap)));
}

function occupiedLength(count: number, pieceLength: number, gap: number): number {
  if (count <= 0) return 0;
  return count * pieceLength + (count - 1) * gap;
}

/**
 * Capacidad de una hoja (Fase 9.4, sección 6-7) — `footprintWidth`/
 * `footprintHeight`/`imposition.gapX`/`gapY` deben llegar YA normalizados
 * a `sheetBoxes.unit` (responsabilidad de quien llama,
 * `computeImpositionLayout`, nunca de esta función). `"automatic"` calcula
 * la capacidad máxima; `"fixed-grid"` valida que el `rows`×`columns`
 * explícito del usuario quepa, sin reducirlo silenciosamente si no cabe
 * (sección 7: "si no caben, genera error; no reduce tamaño").
 */
export function computeGridCapacity(sheetBoxes: SheetPhysicalBoxes, footprintWidth: number, footprintHeight: number, imposition: GridImpositionSpec): GridCapacityResult {
  const { usefulArea } = sheetBoxes;

  if (imposition.placementMode === "fixed-grid") {
    const { rows, columns } = imposition;
    if (rows === undefined || !Number.isInteger(rows) || rows <= 0) return { ok: false, reason: "grid_rows_invalid" };
    if (columns === undefined || !Number.isInteger(columns) || columns <= 0) return { ok: false, reason: "grid_columns_invalid" };

    const occupiedWidth = occupiedLength(columns, footprintWidth, imposition.gapX);
    const occupiedHeight = occupiedLength(rows, footprintHeight, imposition.gapY);
    if (occupiedWidth > usefulArea.width || occupiedHeight > usefulArea.height) {
      return { ok: false, reason: "fixed_grid_does_not_fit" };
    }
    return { ok: true, capacity: { rows, columns, capacity: rows * columns } };
  }

  const columns = fitsCount(usefulArea.width, footprintWidth, imposition.gapX);
  const rows = fitsCount(usefulArea.height, footprintHeight, imposition.gapY);
  if (columns === 0 || rows === 0) return { ok: false, reason: "piece_does_not_fit" };
  return { ok: true, capacity: { rows, columns, capacity: rows * columns } };
}
