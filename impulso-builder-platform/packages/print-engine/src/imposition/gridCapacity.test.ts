import { describe, expect, it } from "vitest";
import { computeGridCapacity } from "./gridCapacity.js";
import { computeSheetPhysicalBoxes } from "./sheetGeometry.js";
import type { GridImpositionSpec } from "../types.js";

function baseImposition(overrides: Partial<GridImpositionSpec> = {}): GridImpositionSpec {
  return {
    mode: "grid",
    sheet: { width: 210, height: 297, unit: "mm" },
    orientation: "portrait",
    quantity: 1,
    placementMode: "automatic",
    gapX: 0,
    gapY: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
    ...overrides,
  };
}

describe("computeGridCapacity — automatic", () => {
  it("calcula filas/columnas máximas sin gaps ni márgenes", () => {
    const imposition = baseImposition();
    const sheet = computeSheetPhysicalBoxes(imposition);
    const result = computeGridCapacity(sheet, 50, 50, imposition);
    expect(result).toEqual({ ok: true, capacity: { rows: 5, columns: 4, capacity: 20 } });
  });

  it("con gaps: reduce cuántas piezas caben por fila/columna", () => {
    const imposition = baseImposition({ gapX: 10, gapY: 10 });
    const sheet = computeSheetPhysicalBoxes(imposition);
    const result = computeGridCapacity(sheet, 50, 50, imposition);
    expect(result).toEqual({ ok: true, capacity: { rows: 5, columns: 3, capacity: 15 } });
  });

  it("pieza más grande que el área útil: piece_does_not_fit", () => {
    const imposition = baseImposition();
    const sheet = computeSheetPhysicalBoxes(imposition);
    const result = computeGridCapacity(sheet, 300, 300, imposition);
    expect(result).toEqual({ ok: false, reason: "piece_does_not_fit" });
  });
});

describe("computeGridCapacity — fixed-grid", () => {
  it("rows/columns explícitos que caben: capacity = rows × columns", () => {
    const imposition = baseImposition({ placementMode: "fixed-grid", rows: 2, columns: 2 });
    const sheet = computeSheetPhysicalBoxes(imposition);
    const result = computeGridCapacity(sheet, 50, 50, imposition);
    expect(result).toEqual({ ok: true, capacity: { rows: 2, columns: 2, capacity: 4 } });
  });

  it("rows/columns explícitos que NO caben: fixed_grid_does_not_fit, nunca se reduce silenciosamente", () => {
    const imposition = baseImposition({ placementMode: "fixed-grid", rows: 100, columns: 100 });
    const sheet = computeSheetPhysicalBoxes(imposition);
    const result = computeGridCapacity(sheet, 50, 50, imposition);
    expect(result).toEqual({ ok: false, reason: "fixed_grid_does_not_fit" });
  });

  it("rows inválido (0/negativo/fraccionario/ausente): grid_rows_invalid", () => {
    const sheet = computeSheetPhysicalBoxes(baseImposition({ placementMode: "fixed-grid", columns: 2 }));
    for (const rows of [0, -1, 1.5, undefined]) {
      const imposition = baseImposition({ placementMode: "fixed-grid", rows, columns: 2 });
      expect(computeGridCapacity(sheet, 50, 50, imposition)).toEqual({ ok: false, reason: "grid_rows_invalid" });
    }
  });

  it("columns inválido (0/negativo/fraccionario/ausente): grid_columns_invalid", () => {
    const sheet = computeSheetPhysicalBoxes(baseImposition({ placementMode: "fixed-grid", rows: 2 }));
    for (const columns of [0, -1, 1.5, undefined]) {
      const imposition = baseImposition({ placementMode: "fixed-grid", rows: 2, columns });
      expect(computeGridCapacity(sheet, 50, 50, imposition)).toEqual({ ok: false, reason: "grid_columns_invalid" });
    }
  });
});
