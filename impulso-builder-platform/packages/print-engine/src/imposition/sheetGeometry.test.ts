import { describe, expect, it } from "vitest";
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

describe("computeSheetPhysicalBoxes", () => {
  it("portrait: usa width/height declarados tal cual", () => {
    const boxes = computeSheetPhysicalBoxes(baseImposition());
    expect(boxes.width).toBe(210);
    expect(boxes.height).toBe(297);
  });

  it("landscape: intercambia width/height declarados, nunca rota contenido", () => {
    const boxes = computeSheetPhysicalBoxes(baseImposition({ orientation: "landscape" }));
    expect(boxes.width).toBe(297);
    expect(boxes.height).toBe(210);
  });

  it("sin márgenes: el área útil ocupa toda la hoja", () => {
    const boxes = computeSheetPhysicalBoxes(baseImposition());
    expect(boxes.usefulArea).toEqual({ x: 0, y: 0, width: 210, height: 297 });
  });

  it("con márgenes por lado: el área útil se reduce y se desplaza", () => {
    const boxes = computeSheetPhysicalBoxes(baseImposition({ marginTop: 10, marginRight: 5, marginBottom: 20, marginLeft: 15 }));
    expect(boxes.usefulArea).toEqual({ x: 15, y: 10, width: 210 - 15 - 5, height: 297 - 10 - 20 });
  });

  it("márgenes que colapsan el área útil: width/height del área útil llegan a 0, nunca negativos", () => {
    const boxes = computeSheetPhysicalBoxes(baseImposition({ marginLeft: 110, marginRight: 110 }));
    expect(boxes.usefulArea.width).toBe(0);
  });
});
