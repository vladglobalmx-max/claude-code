import { describe, expect, it } from "vitest";
import { cutGeometryToPathSegments } from "./cutGeometryToSegments.js";
import type { ClosedPathCutGeometry, EllipseCutGeometry, RectangleCutGeometry } from "./cutGeometry.js";

describe("cutGeometryToPathSegments — rectangle", () => {
  it("produce 4 esquinas + cierre, en las posiciones correctas (sin rotación)", () => {
    const geometry: RectangleCutGeometry = { type: "rectangle", pivot: { x: 10, y: 20 }, width: 30, height: 40, rotationDegrees: 0 };
    const segments = cutGeometryToPathSegments(geometry);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ type: "moveTo", point: { x: 10, y: 20 } });
    expect(segments[1]).toEqual({ type: "lineTo", point: { x: 40, y: 20 } });
    expect(segments[2]).toEqual({ type: "lineTo", point: { x: 40, y: 60 } });
    expect(segments[3]).toEqual({ type: "lineTo", point: { x: 10, y: 60 } });
    expect(segments[4]).toEqual({ type: "close" });
  });
});

describe("cutGeometryToPathSegments — ellipse", () => {
  it("produce 4 curvas cúbicas + cierre, empezando en el punto superior de la elipse", () => {
    const geometry: EllipseCutGeometry = { type: "ellipse", center: { x: 0, y: 0 }, radiusX: 10, radiusY: 5, rotationDegrees: 0 };
    const segments = cutGeometryToPathSegments(geometry);
    expect(segments).toHaveLength(6); // moveTo + 4 cubicCurveTo + close
    expect(segments[0]).toEqual({ type: "moveTo", point: { x: 0, y: -5 } });
    expect(segments[1]!.type).toBe("cubicCurveTo");
    expect(segments[5]).toEqual({ type: "close" });
    // El punto final de la última curva vuelve exactamente al punto de inicio.
    const last = segments[4]!;
    if (last.type !== "cubicCurveTo") throw new Error("se esperaba cubicCurveTo");
    expect(last.point.x).toBeCloseTo(0, 9);
    expect(last.point.y).toBeCloseTo(-5, 9);
  });

  it("respeta el centro y los radios exactos en los 4 puntos cardinales", () => {
    const geometry: EllipseCutGeometry = { type: "ellipse", center: { x: 50, y: 50 }, radiusX: 20, radiusY: 10, rotationDegrees: 0 };
    const segments = cutGeometryToPathSegments(geometry);
    const right = segments[1]!;
    const bottom = segments[2]!;
    const left = segments[3]!;
    if (right.type !== "cubicCurveTo" || bottom.type !== "cubicCurveTo" || left.type !== "cubicCurveTo") throw new Error("tipos inesperados");
    expect(right.point).toEqual({ x: 70, y: 50 });
    expect(bottom.point).toEqual({ x: 50, y: 60 });
    expect(left.point).toEqual({ x: 30, y: 50 });
  });
});

describe("cutGeometryToPathSegments — closed path", () => {
  it("se devuelve tal cual, sin ninguna conversión (ya son segmentos)", () => {
    const geometry: ClosedPathCutGeometry = {
      type: "closed-path",
      segments: [{ type: "moveTo", point: { x: 1, y: 2 } }, { type: "lineTo", point: { x: 3, y: 4 } }, { type: "close" }],
    };
    expect(cutGeometryToPathSegments(geometry)).toBe(geometry.segments);
  });
});
