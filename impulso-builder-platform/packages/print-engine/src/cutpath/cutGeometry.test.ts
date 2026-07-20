import { describe, expect, it } from "vitest";
import { buildEllipse, buildGroup, buildLayer, buildPage, buildPath, buildRectangle, buildText } from "../testUtils/fixtures.js";
import { normalizeCutGeometry, type ClosedPathCutGeometry, type EllipseCutGeometry, type RectangleCutGeometry } from "./cutGeometry.js";
import { traverseObjects } from "./objectTraversal.js";

function traverseOne(page: ReturnType<typeof buildPage>, objectId: string) {
  const found = traverseObjects(page, (o) => o.id === objectId)[0];
  if (!found) throw new Error(`fixture inválida: ${objectId} no encontrado`);
  return found;
}

describe("normalizeCutGeometry — rectangle", () => {
  it("top-level, sin transform: pivot/tamaño/rotación exactos", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 30, height: 40 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const result = normalizeCutGeometry(traverseOne(page, "rect_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.type).toBe("rectangle");
    expect(geometry.pivot).toEqual({ x: 10, y: 20 });
    expect(geometry.width).toBeCloseTo(30, 9);
    expect(geometry.height).toBeCloseTo(40, 9);
    expect(geometry.rotationDegrees).toBeCloseTo(0, 9);
  });

  it("rotado 30°, escala uniforme 2x: rotación y tamaño reflejan la composición", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 30, scaleX: 2, scaleY: 2 }, size: { width: 10, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const result = normalizeCutGeometry(traverseOne(page, "rect_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.rotationDegrees).toBeCloseTo(30, 6);
    expect(geometry.width).toBeCloseTo(20, 9);
    expect(geometry.height).toBeCloseTo(20, 9);
  });

  it("dentro de un group trasladado+rotado: la geometría resultante es global, no local", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } });
    const group = buildGroup("group_1", [rect], { transform: { x: 100, y: 100, rotation: 90, scaleX: 1, scaleY: 1 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    const result = normalizeCutGeometry(traverseOne(page, "rect_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as RectangleCutGeometry;
    expect(geometry.rotationDegrees).toBeCloseTo(90, 6);
    // El pivote local (5,0) rotado 90° alrededor del origen del group da (0,5), + offset (100,100).
    expect(geometry.pivot.x).toBeCloseTo(100, 6);
    expect(geometry.pivot.y).toBeCloseTo(105, 6);
  });

  it("group con escala no-uniforme + rectangle rotado dentro: shear real -> se representa como closed-path exacto (4 esquinas)", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } });
    const group = buildGroup("group_1", [rect], { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 4 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    const result = normalizeCutGeometry(traverseOne(page, "rect_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.type).toBe("closed-path");
    const geometry = result.geometry as ClosedPathCutGeometry;
    // 4 esquinas (moveTo + 3 lineTo) + close = 5 segmentos, nunca aproximado a un rectángulo.
    expect(geometry.segments).toHaveLength(5);
    expect(geometry.segments[4]!.type).toBe("close");
  });
});

describe("normalizeCutGeometry — ellipse", () => {
  it("top-level: center es el centro real de la caja, no la esquina", () => {
    const ellipse = buildEllipse("ellipse_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 20, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [ellipse])]);
    const result = normalizeCutGeometry(traverseOne(page, "ellipse_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as EllipseCutGeometry;
    expect(geometry.center).toEqual({ x: 10, y: 5 });
    expect(geometry.radiusX).toBeCloseTo(10, 9);
    expect(geometry.radiusY).toBeCloseTo(5, 9);
  });

  it("rotada + escalada: radios y rotación reflejan la composición", () => {
    const ellipse = buildEllipse("ellipse_1", { transform: { x: 0, y: 0, rotation: 15, scaleX: 3, scaleY: 3 }, size: { width: 20, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [ellipse])]);
    const result = normalizeCutGeometry(traverseOne(page, "ellipse_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as EllipseCutGeometry;
    expect(geometry.rotationDegrees).toBeCloseTo(15, 6);
    expect(geometry.radiusX).toBeCloseTo(30, 6);
    expect(geometry.radiusY).toBeCloseTo(15, 6);
  });

  it("bajo shear real (ancestro con escala no-uniforme + rotación en otro nivel): transform-unsupported", () => {
    const ellipse = buildEllipse("ellipse_1", { transform: { x: 0, y: 0, rotation: 20, scaleX: 1, scaleY: 1 }, size: { width: 20, height: 10 } });
    const group = buildGroup("group_1", [ellipse], { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 5 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    const result = normalizeCutGeometry(traverseOne(page, "ellipse_1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("transform-unsupported");
  });
});

describe("normalizeCutGeometry — closed path", () => {
  it("path cerrado top-level: cada punto se transforma, cierre implícito preservado", () => {
    const path = buildPath("path_1", {
      transform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
      segments: [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 10 } },
      ],
      closed: true,
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])]);
    const result = normalizeCutGeometry(traverseOne(page, "path_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as ClosedPathCutGeometry;
    expect(geometry.segments[0]).toEqual({ type: "moveTo", point: { x: 100, y: 200 } });
    expect(geometry.segments[1]).toEqual({ type: "lineTo", point: { x: 110, y: 200 } });
    expect(geometry.segments[2]).toEqual({ type: "lineTo", point: { x: 110, y: 210 } });
  });

  it("path dentro de un group rotado: los puntos reflejan la posición global, nunca la local", () => {
    const path = buildPath("path_1", {
      transform: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      segments: [{ type: "moveTo", point: { x: 0, y: 0 } }, { type: "lineTo", point: { x: 1, y: 0 } }],
      closed: true,
    });
    const group = buildGroup("group_1", [path], { transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    const result = normalizeCutGeometry(traverseOne(page, "path_1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = result.geometry as ClosedPathCutGeometry;
    const first = geometry.segments[0]!;
    if (first.type !== "moveTo") throw new Error("se esperaba moveTo");
    expect(first.point.x).toBeCloseTo(0, 6);
    expect(first.point.y).toBeCloseTo(5, 6);
  });

  it("path abierto (closed: false): open-path", () => {
    const path = buildPath("path_1", { closed: false });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])]);
    const result = normalizeCutGeometry(traverseOne(page, "path_1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("open-path");
  });
});

describe("normalizeCutGeometry — tipo no soportado", () => {
  it("Text: unsupported-object-type", () => {
    const text = buildText("text_1");
    const page = buildPage("page_1", [buildLayer("layer_1", [text])]);
    const result = normalizeCutGeometry(traverseOne(page, "text_1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported-object-type");
  });
});
