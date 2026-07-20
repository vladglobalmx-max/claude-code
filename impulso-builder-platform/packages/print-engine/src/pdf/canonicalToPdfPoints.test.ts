import { describe, expect, it } from "vitest";
import { canonicalPointToPdfPoint, cropMarkSegmentToPdf, cutPathSegmentsToPdf } from "./canonicalToPdfPoints.js";
import type { CropMarkSegment } from "../marks/cropMarksGeometry.js";
import type { PdfBoxPt } from "./pdfBackend.js";

describe("cropMarkSegmentToPdf", () => {
  it("x se mantiene igual, y se refleja respecto a mediaHeightPt", () => {
    const segment: CropMarkSegment = { from: { x: 10, y: 5 }, to: { x: 20, y: 5 }, unit: "mm", strokeWidth: 0.25, color: "#000000" };
    const result = cropMarkSegmentToPdf(segment, 300 /* pt, ya en la unidad correcta para el ejemplo */);
    // 300pt de mediaHeight, con un punto en y=5mm (~14.17pt): pdfY = 300 - 14.17.
    expect(result.from.x).toBeCloseTo(10 * (72 / 25.4), 6);
    expect(result.from.y).toBeCloseTo(300 - 5 * (72 / 25.4), 6);
    expect(result.to.x).toBeCloseTo(20 * (72 / 25.4), 6);
  });

  it("strokeWidth y color se propagan sin cambios", () => {
    const segment: CropMarkSegment = { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, unit: "mm", strokeWidth: 0.5, color: "#ff0000" };
    const result = cropMarkSegmentToPdf(segment, 100);
    expect(result.strokeWidthPt).toBeCloseTo(0.5 * (72 / 25.4), 6);
    expect(result.colorHex).toBe("#ff0000");
  });
});

describe("canonicalPointToPdfPoint", () => {
  const TRIM_BOX_PT: PdfBoxPt = { x: 10, y: 20, width: 200, height: 100 };

  it("el origen canónico (0,0 — esquina superior izquierda del trim) cae en la esquina superior izquierda del TrimBox en espacio PDF", () => {
    const result = canonicalPointToPdfPoint({ x: 0, y: 0 }, TRIM_BOX_PT);
    expect(result).toEqual({ x: 10, y: 120 }); // trimBox.y + trimBox.height
  });

  it("un punto en la esquina inferior-derecha del trim (en px canónico) cae en la esquina inferior-derecha del TrimBox en espacio PDF", () => {
    // trim de 200pt de ancho == unitToPoints(x,"px") == 200 -> x = 200 / (72/96) = 200*96/72 px canónico.
    const trimWidthCanonicalPx = (200 * 96) / 72;
    const trimHeightCanonicalPx = (100 * 96) / 72;
    const result = canonicalPointToPdfPoint({ x: trimWidthCanonicalPx, y: trimHeightCanonicalPx }, TRIM_BOX_PT);
    expect(result.x).toBeCloseTo(210, 6); // trimBox.x + trimBox.width
    expect(result.y).toBeCloseTo(20, 6); // trimBox.y
  });
});

describe("cutPathSegmentsToPdf", () => {
  const TRIM_BOX_PT: PdfBoxPt = { x: 0, y: 0, width: 96 * (72 / 96), height: 96 * (72 / 96) }; // 1 pulgada de trim, en la esquina (0,0)

  it("transforma moveTo/lineTo/close preservando el orden y tipo de cada segmento", () => {
    const segments = cutPathSegmentsToPdf(
      [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 96, y: 0 } },
        { type: "close" },
      ],
      TRIM_BOX_PT,
    );
    expect(segments.map((s) => s.type)).toEqual(["moveTo", "lineTo", "close"]);
    const first = segments[0]!;
    if (first.type !== "moveTo") throw new Error("se esperaba moveTo");
    expect(first.point.y).toBeCloseTo(TRIM_BOX_PT.height, 6); // y=0 canónico -> borde superior -> y=height en PDF
  });

  it("transforma control points de curvas cúbicas y cuadráticas", () => {
    const segments = cutPathSegmentsToPdf(
      [
        { type: "quadraticCurveTo", control: { x: 10, y: 10 }, point: { x: 20, y: 0 } },
        { type: "cubicCurveTo", control1: { x: 5, y: 5 }, control2: { x: 15, y: 15 }, point: { x: 30, y: 0 } },
      ],
      TRIM_BOX_PT,
    );
    expect(segments[0]!.type).toBe("quadraticCurveTo");
    expect(segments[1]!.type).toBe("cubicCurveTo");
  });
});
