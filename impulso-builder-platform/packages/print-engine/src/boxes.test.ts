import { describe, expect, it } from "vitest";
import { computeBoxes, cropMarkStartDistance } from "./boxes.js";
import type { BleedSpec, CropMarksSpec, PhysicalSize } from "./types.js";

const TRIM_A4: PhysicalSize = { width: 210, height: 297, unit: "mm" };
const NO_BLEED: BleedSpec = { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" };
const NO_SAFE = { enabled: false, margin: 0, unit: "mm" as const };
const NO_MARKS: CropMarksSpec = { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm" };

describe("computeBoxes — TrimBox", () => {
  it("TrimBox es exactamente PrintJob.dimensions, sin cambios", () => {
    const boxes = computeBoxes(TRIM_A4, NO_BLEED, NO_SAFE, NO_MARKS);
    expect(boxes.trim).toEqual(TRIM_A4);
  });
});

describe("computeBoxes — BleedBox", () => {
  it("sin bleed, BleedBox == TrimBox", () => {
    const boxes = computeBoxes(TRIM_A4, NO_BLEED, NO_SAFE, NO_MARKS);
    expect(boxes.bleed).toEqual({ width: 210, height: 297, unit: "mm" });
  });

  it("bleed uniforme de 3mm agrega 3mm por cada lado (6mm por eje)", () => {
    const bleed: BleedSpec = { top: 3, right: 3, bottom: 3, left: 3, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, NO_MARKS);
    expect(boxes.bleed).toEqual({ width: 216, height: 303, unit: "mm" });
  });

  it("bleed por lado (asimétrico) se respeta exactamente, sin promediar", () => {
    const bleed: BleedSpec = { top: 2, right: 5, bottom: 3, left: 1, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, NO_MARKS);
    expect(boxes.bleed).toEqual({ width: 210 + 1 + 5, height: 297 + 2 + 3, unit: "mm" });
    expect(boxes.trimOffsetWithinBleed).toEqual({ x: 1, y: 2 });
  });

  it("bleed en una unidad distinta a trim se normaliza antes de sumar (0.125in == 3.175mm)", () => {
    const bleed: BleedSpec = { top: 0.125, right: 0.125, bottom: 0.125, left: 0.125, unit: "in" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, NO_MARKS);
    expect(boxes.bleed.width).toBeCloseTo(210 + 2 * 3.175, 6);
    expect(boxes.bleed.height).toBeCloseTo(297 + 2 * 3.175, 6);
  });
});

describe("computeBoxes — SafeAreaBox", () => {
  it("deshabilitado, SafeAreaBox == TrimBox", () => {
    const boxes = computeBoxes(TRIM_A4, NO_BLEED, NO_SAFE, NO_MARKS);
    expect(boxes.safeArea).toEqual(TRIM_A4);
  });

  it("habilitado con margen de 5mm, resta 5mm por cada lado (10mm por eje) — nunca excede el trim", () => {
    const boxes = computeBoxes(TRIM_A4, NO_BLEED, { enabled: true, margin: 5, unit: "mm" }, NO_MARKS);
    expect(boxes.safeArea).toEqual({ width: 200, height: 287, unit: "mm" });
  });

  it("un margen mayor a la mitad del trim nunca produce un tamaño negativo (se recorta a 0)", () => {
    const boxes = computeBoxes(
      { width: 10, height: 10, unit: "mm" },
      NO_BLEED,
      { enabled: true, margin: 100, unit: "mm" },
      NO_MARKS,
    );
    expect(boxes.safeArea.width).toBe(0);
    expect(boxes.safeArea.height).toBe(0);
  });
});

describe("cropMarkStartDistance", () => {
  it("con bleed=0, la marca empieza exactamente al offset configurado", () => {
    expect(cropMarkStartDistance(0, 3)).toBe(3);
  });

  it("con bleed > offset, la marca NUNCA invade el bleed — empieza en el borde del bleed, no antes", () => {
    expect(cropMarkStartDistance(5, 3)).toBe(5);
  });

  it("con offset > bleed, respeta el offset configurado (separación mínima respecto al trim)", () => {
    expect(cropMarkStartDistance(1, 3)).toBe(3);
  });
});

describe("computeBoxes — MediaBox", () => {
  it("sin crop marks, MediaBox == BleedBox", () => {
    const bleed: BleedSpec = { top: 3, right: 3, bottom: 3, left: 3, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, NO_MARKS);
    expect(boxes.media).toEqual(boxes.bleed);
  });

  it("con crop marks, MediaBox crece más allá del BleedBox por offset+length en cada lado", () => {
    const bleed: BleedSpec = { top: 3, right: 3, bottom: 3, left: 3, unit: "mm" };
    const marks: CropMarksSpec = { enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, marks);
    // cropMarkStartDistance(3,3) = 3 (offset == bleed) + length 5 = 8 por lado.
    expect(boxes.media).toEqual({ width: 210 + 2 * 8, height: 297 + 2 * 8, unit: "mm" });
    expect(boxes.media.width).toBeGreaterThan(boxes.bleed.width);
  });

  it("crop marks nunca invaden el TrimBox: MediaBox siempre >= TrimBox en ambos ejes", () => {
    const marks: CropMarksSpec = { enabled: true, length: 5, offset: 2, strokeWidth: 0.25, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, NO_BLEED, NO_SAFE, marks);
    expect(boxes.media.width).toBeGreaterThanOrEqual(boxes.trim.width);
    expect(boxes.media.height).toBeGreaterThanOrEqual(boxes.trim.height);
  });

  it("MediaBox nunca es más chico que BleedBox, con o sin marcas", () => {
    const bleed: BleedSpec = { top: 3, right: 3, bottom: 3, left: 3, unit: "mm" };
    for (const marksEnabled of [true, false]) {
      const marks: CropMarksSpec = { enabled: marksEnabled, length: 5, offset: 1, strokeWidth: 0.25, unit: "mm" };
      const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, marks);
      expect(boxes.media.width).toBeGreaterThanOrEqual(boxes.bleed.width);
      expect(boxes.media.height).toBeGreaterThanOrEqual(boxes.bleed.height);
    }
  });

  it("trimOffsetWithinMedia posiciona correctamente el trim dentro del media (bleed asimétrico + marcas)", () => {
    const bleed: BleedSpec = { top: 2, right: 5, bottom: 3, left: 1, unit: "mm" };
    const marks: CropMarksSpec = { enabled: true, length: 4, offset: 2, strokeWidth: 0.25, unit: "mm" };
    const boxes = computeBoxes(TRIM_A4, bleed, NO_SAFE, marks);
    // left: max(1,2)+4 = 6; top: max(2,2)+4 = 6
    expect(boxes.trimOffsetWithinMedia).toEqual({ x: 6, y: 6 });
  });
});
