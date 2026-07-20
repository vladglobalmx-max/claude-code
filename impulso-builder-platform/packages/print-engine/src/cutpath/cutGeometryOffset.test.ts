import { describe, expect, it } from "vitest";
import { applyCutGeometryOffset } from "./cutGeometryOffset.js";
import type { ClosedPathCutGeometry, EllipseCutGeometry, RectangleCutGeometry } from "./cutGeometry.js";

const RECT: RectangleCutGeometry = { type: "rectangle", pivot: { x: 10, y: 10 }, width: 20, height: 30, rotationDegrees: 0 };
const ELLIPSE: EllipseCutGeometry = { type: "ellipse", center: { x: 50, y: 50 }, radiusX: 10, radiusY: 5, rotationDegrees: 0 };
const PATH: ClosedPathCutGeometry = {
  type: "closed-path",
  segments: [{ type: "moveTo", point: { x: 0, y: 0 } }, { type: "lineTo", point: { x: 10, y: 0 } }, { type: "close" }],
};

describe("applyCutGeometryOffset — offset 0", () => {
  it("cualquier tipo con offset 0 devuelve la geometría original sin cambios", () => {
    expect(applyCutGeometryOffset(RECT, 0)).toEqual({ status: "ok", geometry: RECT });
    expect(applyCutGeometryOffset(ELLIPSE, 0)).toEqual({ status: "ok", geometry: ELLIPSE });
    expect(applyCutGeometryOffset(PATH, 0)).toEqual({ status: "ok", geometry: PATH });
  });
});

describe("applyCutGeometryOffset — rectangle", () => {
  it("offset positivo (expandir), sin rotación: crece 2x el offset en cada eje, centro fijo", () => {
    const result = applyCutGeometryOffset(RECT, 5);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.width).toBeCloseTo(30, 9);
    expect(geometry.height).toBeCloseTo(40, 9);
    expect(geometry.pivot).toEqual({ x: 5, y: 5 });
    // Centro original: (10+10, 10+15) = (20,25). Centro nuevo: pivot + (width/2,height/2) = (5+15, 5+20) = (20,25).
    expect(geometry.pivot.x + geometry.width / 2).toBeCloseTo(20, 9);
    expect(geometry.pivot.y + geometry.height / 2).toBeCloseTo(25, 9);
  });

  it("offset negativo (contraer): reduce el tamaño manteniendo el centro", () => {
    const result = applyCutGeometryOffset(RECT, -5);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.width).toBeCloseTo(10, 9);
    expect(geometry.height).toBeCloseTo(20, 9);
  });

  it("offset negativo que colapsa (>= la mitad del lado más chico): collapsed", () => {
    const result = applyCutGeometryOffset(RECT, -10);
    expect(result).toEqual({ status: "collapsed" });
  });

  it("rotado: el desplazamiento del pivote se rota junto con el rectángulo (el centro sigue fijo)", () => {
    const rotated: RectangleCutGeometry = { type: "rectangle", pivot: { x: 0, y: 0 }, width: 10, height: 10, rotationDegrees: 90 };
    const result = applyCutGeometryOffset(rotated, 5);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.width).toBeCloseTo(20, 9);
    expect(geometry.height).toBeCloseTo(20, 9);
    // Centro original: rotar (5,5) 90° desde pivot (0,0) -> (-5,5); nuevo centro debe coincidir.
    const originalCenterLocal = { x: 5, y: 5 };
    const rad = (90 * Math.PI) / 180;
    const originalCenterGlobal = {
      x: rotated.pivot.x + originalCenterLocal.x * Math.cos(rad) - originalCenterLocal.y * Math.sin(rad),
      y: rotated.pivot.y + originalCenterLocal.x * Math.sin(rad) + originalCenterLocal.y * Math.cos(rad),
    };
    const newCenterLocal = { x: geometry.width / 2, y: geometry.height / 2 };
    const newCenterGlobal = {
      x: geometry.pivot.x + newCenterLocal.x * Math.cos(rad) - newCenterLocal.y * Math.sin(rad),
      y: geometry.pivot.y + newCenterLocal.x * Math.sin(rad) + newCenterLocal.y * Math.cos(rad),
    };
    expect(newCenterGlobal.x).toBeCloseTo(originalCenterGlobal.x, 6);
    expect(newCenterGlobal.y).toBeCloseTo(originalCenterGlobal.y, 6);
  });
});

describe("applyCutGeometryOffset — ellipse", () => {
  it("offset positivo: expande ambos radios, centro fijo", () => {
    const result = applyCutGeometryOffset(ELLIPSE, 3);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const geometry = result.geometry as EllipseCutGeometry;
    expect(geometry.radiusX).toBeCloseTo(13, 9);
    expect(geometry.radiusY).toBeCloseTo(8, 9);
    expect(geometry.center).toEqual(ELLIPSE.center);
  });

  it("offset negativo que colapsa el radio menor: collapsed", () => {
    const result = applyCutGeometryOffset(ELLIPSE, -5);
    expect(result).toEqual({ status: "collapsed" });
  });
});

describe("applyCutGeometryOffset — closed path", () => {
  it("offset distinto de cero: unsupported, devuelve la geometría ORIGINAL sin desplazar nada", () => {
    const result = applyCutGeometryOffset(PATH, 2);
    expect(result).toEqual({ status: "unsupported", geometry: PATH });
  });
});
