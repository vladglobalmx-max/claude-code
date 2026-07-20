import { describe, expect, it } from "vitest";
import { computeBoxes } from "../boxes.js";
import type { BleedSpec, CropMarksSpec, PhysicalSize } from "../types.js";
import { computeCropMarksGeometry } from "./cropMarksGeometry.js";

const TRIM: PhysicalSize = { width: 50, height: 50, unit: "mm" };
const NO_SAFE = { enabled: false, margin: 0, unit: "mm" as const };
const MARKS: CropMarksSpec = { enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" };

function geometryFor(bleed: BleedSpec, marks: CropMarksSpec = MARKS) {
  const boxes = computeBoxes(TRIM, bleed, NO_SAFE, marks);
  return { boxes, segments: computeCropMarksGeometry(boxes, marks) };
}

describe("computeCropMarksGeometry", () => {
  it("deshabilitado: no produce ningún segmento", () => {
    const boxes = computeBoxes(TRIM, { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" }, NO_SAFE, { ...MARKS, enabled: false });
    expect(computeCropMarksGeometry(boxes, { ...MARKS, enabled: false })).toEqual([]);
  });

  it("produce exactamente 8 segmentos (2 por esquina, 4 esquinas)", () => {
    const { segments } = geometryFor({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" });
    expect(segments).toHaveLength(8);
  });

  it("bleed cero: las marcas empiezan exactamente al offset configurado del TrimBox", () => {
    const { boxes, segments } = geometryFor({ top: 0, right: 0, bottom: 0, left: 0, unit: "mm" });
    const topLeftHorizontal = segments[0]!;
    // El extremo interior (más cercano al trim) está a `offset` (3mm) del borde izquierdo del trim.
    expect(boxes.trimOffsetWithinMedia.x - topLeftHorizontal.to.x).toBeCloseTo(3, 6);
  });

  it("bleed uniforme mayor al offset: las marcas empiezan en el borde del bleed, no antes (nunca lo invaden)", () => {
    const { boxes, segments } = geometryFor({ top: 8, right: 8, bottom: 8, left: 8, unit: "mm" }, { ...MARKS, offset: 3 });
    const topLeftHorizontal = segments[0]!;
    const distanceFromTrim = boxes.trimOffsetWithinMedia.x - topLeftHorizontal.to.x;
    expect(distanceFromTrim).toBeCloseTo(8, 6); // bleed (8mm) > offset (3mm) -> usa el bleed
  });

  it("bleed asimétrico: cada lado usa su propio bleed para decidir dónde empieza la marca", () => {
    const { boxes, segments } = geometryFor({ top: 2, right: 4, bottom: 6, left: 8, unit: "mm" });
    const [topLeftH, topLeftV, topRightH] = segments;
    const distLeft = boxes.trimOffsetWithinMedia.x - topLeftH!.to.x;
    const distTop = boxes.trimOffsetWithinMedia.y - topLeftV!.to.y;
    expect(distLeft).toBeCloseTo(8, 6); // bleedLeft (8mm) > offset (3mm)
    expect(distTop).toBeCloseTo(3, 6); // offset (3mm) > bleedTop (2mm)
    expect(topRightH!.from.x - (boxes.trimOffsetWithinMedia.x + boxes.trim.width)).toBeCloseTo(4, 6); // bleedRight (4mm) > offset (3mm)
  });

  it("longitud (length) se respeta exactamente en cada segmento", () => {
    const { segments } = geometryFor({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" }, { ...MARKS, length: 7 });
    for (const segment of segments) {
      const dx = Math.abs(segment.to.x - segment.from.x);
      const dy = Math.abs(segment.to.y - segment.from.y);
      // Cada segmento es horizontal o vertical — la dimensión no-cero es exactamente `length`.
      expect(Math.max(dx, dy)).toBeCloseTo(7, 6);
      expect(Math.min(dx, dy)).toBeCloseTo(0, 6);
    }
  });

  it("grosor (strokeWidth) se propaga a cada segmento", () => {
    const { segments } = geometryFor({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" }, { ...MARKS, strokeWidth: 0.5 });
    for (const segment of segments) expect(segment.strokeWidth).toBeCloseTo(0.5, 6);
  });

  it("unidad distinta a la de la página (in vs mm) se normaliza correctamente", () => {
    const marksIn: CropMarksSpec = { enabled: true, length: 0.25, offset: 0.125, strokeWidth: 0.01, unit: "in", color: "#000000" };
    const { boxes, segments } = geometryFor({ top: 0, right: 0, bottom: 0, left: 0, unit: "mm" }, marksIn);
    const topLeftHorizontal = segments[0]!;
    const distanceFromTrim = boxes.trimOffsetWithinMedia.x - topLeftHorizontal.to.x;
    expect(distanceFromTrim).toBeCloseTo(0.125 * 25.4, 4); // 0.125in en mm
  });

  it("MediaBox insuficiente (calculado por computeBoxes) siempre alcanza para las marcas: el extremo exterior cae justo en el borde", () => {
    const { boxes, segments } = geometryFor({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" });
    const topLeftHorizontal = segments[0]!;
    expect(topLeftHorizontal.from.x).toBeCloseTo(0, 6); // borde izquierdo del MediaBox
    const bottomRightVertical = segments[7]!;
    expect(bottomRightVertical.to.y).toBeCloseTo(boxes.media.height, 6); // borde inferior del MediaBox
  });

  it("ninguna marca invade el TrimBox: todos los puntos quedan fuera de sus 4 bordes", () => {
    const { boxes, segments } = geometryFor({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" });
    const trimLeft = boxes.trimOffsetWithinMedia.x;
    const trimTop = boxes.trimOffsetWithinMedia.y;
    const trimRight = trimLeft + boxes.trim.width;
    const trimBottom = trimTop + boxes.trim.height;
    for (const segment of segments) {
      for (const point of [segment.from, segment.to]) {
        const insideTrim = point.x > trimLeft + 1e-9 && point.x < trimRight - 1e-9 && point.y > trimTop + 1e-9 && point.y < trimBottom - 1e-9;
        expect(insideTrim).toBe(false);
      }
    }
  });
});
