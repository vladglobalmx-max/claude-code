import { describe, expect, it } from "vitest";
import { canonicalPointToRasterPoint, cropMarkSegmentToRaster, cutPathSegmentsToRaster } from "./canonicalToRasterPoints.js";
import type { CropMarkSegment } from "../marks/cropMarksGeometry.js";

describe("cropMarkSegmentToRaster", () => {
  it("convierte de la unidad física del segmento a px de raster, a targetPpi", () => {
    const segment: CropMarkSegment = { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, unit: "in", strokeWidth: 0.01, color: "#000000" };
    const result = cropMarkSegmentToRaster(segment, 300);
    expect(result.from).toEqual({ x: 300, y: 0 });
    expect(result.to).toEqual({ x: 600, y: 0 });
    expect(result.strokeWidthPx).toBeCloseTo(3, 6);
    expect(result.color).toBe("#000000");
  });
});

describe("canonicalPointToRasterPoint", () => {
  it("compone el offset de contenido (bleed) y el offset del bleed dentro del media, escalados por canonicalScale", () => {
    // canonicalScale = 300/96 (targetPpi 300); contentOffset = 10px canónico (bleed); bleedOffsetRasterPx = 50px raster (espacio de marcas).
    const canonicalScale = 300 / 96;
    const result = canonicalPointToRasterPoint({ x: 5, y: 0 }, canonicalScale, { x: 10, y: 0 }, { x: 50, y: 0 });
    // (10+5) * (300/96) + 50
    expect(result.x).toBeCloseTo(15 * canonicalScale + 50, 6);
  });

  it("sin ningún offset, es exactamente point × canonicalScale", () => {
    const result = canonicalPointToRasterPoint({ x: 96, y: 96 }, 300 / 96, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(300, 6);
    expect(result.y).toBeCloseTo(300, 6);
  });
});

describe("cutPathSegmentsToRaster", () => {
  it("transforma todos los tipos de segmento preservando el orden", () => {
    const segments = cutPathSegmentsToRaster(
      [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 96, y: 0 } },
        { type: "quadraticCurveTo", control: { x: 10, y: 10 }, point: { x: 20, y: 0 } },
        { type: "cubicCurveTo", control1: { x: 1, y: 1 }, control2: { x: 2, y: 2 }, point: { x: 3, y: 3 } },
        { type: "close" },
      ],
      300 / 96,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    );
    expect(segments.map((s) => s.type)).toEqual(["moveTo", "lineTo", "quadraticCurveTo", "cubicCurveTo", "close"]);
    const second = segments[1]!;
    if (second.type !== "lineTo") throw new Error("se esperaba lineTo");
    expect(second.point.x).toBeCloseTo(300, 6);
  });
});
