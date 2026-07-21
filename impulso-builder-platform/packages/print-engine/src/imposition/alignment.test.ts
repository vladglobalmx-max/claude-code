import { describe, expect, it } from "vitest";
import { computeAlignmentOffset } from "./alignment.js";
import type { ImpositionAlignment } from "../types.js";

// Área útil de 100×100, grid de 60×40 — deja 40 de espacio horizontal
// libre y 60 de espacio vertical libre para verificar las 9 posiciones.
const USEFUL_W = 100;
const USEFUL_H = 100;
const GRID_W = 60;
const GRID_H = 40;

describe("computeAlignmentOffset — las 9 posiciones", () => {
  const cases: Array<[ImpositionAlignment, { x: number; y: number }]> = [
    ["top-left", { x: 0, y: 0 }],
    ["top-center", { x: 20, y: 0 }],
    ["top-right", { x: 40, y: 0 }],
    ["center-left", { x: 0, y: 30 }],
    ["center", { x: 20, y: 30 }],
    ["center-right", { x: 40, y: 30 }],
    ["bottom-left", { x: 0, y: 60 }],
    ["bottom-center", { x: 20, y: 60 }],
    ["bottom-right", { x: 40, y: 60 }],
  ];

  it.each(cases)("%s produce el offset esperado", (alignment, expected) => {
    const offset = computeAlignmentOffset(alignment, USEFUL_W, USEFUL_H, GRID_W, GRID_H);
    expect(offset.x).toBeCloseTo(expected.x, 6);
    expect(offset.y).toBeCloseTo(expected.y, 6);
  });

  it("grid del mismo tamaño que el área útil: cualquier alineación produce offset (0,0)", () => {
    for (const [alignment] of cases) {
      expect(computeAlignmentOffset(alignment, 100, 100, 100, 100)).toEqual({ x: 0, y: 0 });
    }
  });
});
