import { describe, expect, it } from "vitest";
import Konva from "konva";
import {
  computeManipulationBox,
  computeObjectBoundingBox,
  localHandlePoint,
  localRotateHandlePoint,
  localToParent,
} from "./boundingBox.js";
import { buildRectangle, buildEllipse, buildGroup } from "../testUtils/fixtures.js";

describe("computeManipulationBox", () => {
  it("mide intrinsicSize a partir de getSelfRect() del node, no del scale aplicado", () => {
    const object = buildRectangle("rect_1", {
      transform: { x: 10, y: 20, rotation: 0, scaleX: 2, scaleY: 3 },
      size: { width: 10, height: 10 },
    });
    const node = new Konva.Rect({ x: 10, y: 20, width: 10, height: 10, scaleX: 2, scaleY: 3 });

    const box = computeManipulationBox(node, object);

    expect(box.intrinsicSize).toEqual({ width: 10, height: 10 });
    expect(box.currentWidth).toBe(20); // 10 * scaleX 2
    expect(box.currentHeight).toBe(30); // 10 * scaleY 3
  });

  it("el pivote es la posición x/y del node Konva (esquina superior izquierda para rectangle)", () => {
    const object = buildRectangle("rect_1", { transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 10, y: 20, width: 10, height: 10 });

    const box = computeManipulationBox(node, object);

    expect(box.pivot).toEqual({ x: 10, y: 20 });
    expect(box.originOffset).toEqual({ x: 0, y: 0 });
  });

  it("para ellipse, originOffset centra la caja (el pivote de Konva es el centro)", () => {
    const object = buildEllipse("e_1", { size: { width: 20, height: 10 } });
    const node = new Konva.Ellipse({ x: 50, y: 50, radiusX: 10, radiusY: 5 });

    const box = computeManipulationBox(node, object);

    expect(box.currentWidth).toBe(20);
    expect(box.currentHeight).toBe(10);
    expect(box.originOffset).toEqual({ x: -10, y: -5 });
  });

  it("usa getClientRect({ skipTransform: true }) para un Group (no implementa getSelfRect)", () => {
    const object = buildGroup("g_1", []);
    const group = new Konva.Group({ x: 5, y: 5 });
    group.add(new Konva.Rect({ x: 0, y: 0, width: 40, height: 15 }));

    const box = computeManipulationBox(group, object);

    expect(box.intrinsicSize.width).toBeCloseTo(40, 5);
    expect(box.intrinsicSize.height).toBeCloseTo(15, 5);
  });

  it("captura la rotación actual del node", () => {
    const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 0, y: 0, width: 10, height: 10, rotation: 45 });

    const box = computeManipulationBox(node, object);

    expect(box.rotationDegrees).toBe(45);
  });
});

describe("computeObjectBoundingBox", () => {
  it("sin rotación, es la caja tal cual (mismo resultado que sumar pivote+tamaño a mano)", () => {
    const object = buildRectangle("rect_1", { transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 10, y: 20, width: 30, height: 40 });

    const box = computeObjectBoundingBox(node, object);

    expect(box).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });

  it("aplica scaleX/scaleY antes de calcular el AABB (usa currentWidth/currentHeight, no intrinsicSize crudo)", () => {
    const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 3 } });
    const node = new Konva.Rect({ x: 0, y: 0, width: 10, height: 10, scaleX: 2, scaleY: 3 });

    const box = computeObjectBoundingBox(node, object);

    expect(box).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 30 });
  });

  it("con rotación, el AABB refleja la caja rotada real, no la caja sin rotar", () => {
    const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 0, y: 0, width: 40, height: 10, rotation: 90 });

    const box = computeObjectBoundingBox(node, object);

    // 40x10 rotado 90°: el AABB pasa a ser 10 de ancho x 40 de alto.
    expect(box.maxX - box.minX).toBeCloseTo(10, 6);
    expect(box.maxY - box.minY).toBeCloseTo(40, 6);
  });

  it("para ellipse, usa originOffset (pivote-centro) al calcular el AABB", () => {
    const object = buildEllipse("e_1", { transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Ellipse({ x: 50, y: 50, radiusX: 10, radiusY: 5 });

    const box = computeObjectBoundingBox(node, object);

    expect(box).toEqual({ minX: 40, minY: 45, maxX: 60, maxY: 55 });
  });

  it("para un Group, mide sus hijos vía getClientRect (sin size propio en el Document Schema)", () => {
    const object = buildGroup("g_1", []);
    const group = new Konva.Group({ x: 5, y: 5 });
    group.add(new Konva.Rect({ x: 0, y: 0, width: 40, height: 15 }));

    const box = computeObjectBoundingBox(group, object);

    expect(box.minX).toBeCloseTo(5, 5);
    expect(box.minY).toBeCloseTo(5, 5);
    expect(box.maxX - box.minX).toBeCloseTo(40, 5);
    expect(box.maxY - box.minY).toBeCloseTo(15, 5);
  });
});

describe("localHandlePoint", () => {
  const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
  const node = new Konva.Rect({ x: 0, y: 0, width: 10, height: 20 });
  const box = computeManipulationBox(node, object); // currentWidth=10, currentHeight=20, originOffset={0,0}

  it.each([
    ["top-left", { x: 0, y: 0 }],
    ["top", { x: 5, y: 0 }],
    ["top-right", { x: 10, y: 0 }],
    ["left", { x: 0, y: 10 }],
    ["right", { x: 10, y: 10 }],
    ["bottom-left", { x: 0, y: 20 }],
    ["bottom", { x: 5, y: 20 }],
    ["bottom-right", { x: 10, y: 20 }],
  ] as const)("%s -> %o", (handle, expected) => {
    expect(localHandlePoint(box, handle)).toEqual(expected);
  });
});

describe("localRotateHandlePoint", () => {
  it("queda centrado horizontalmente y `offset` px arriba del borde superior de la caja", () => {
    const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 0, y: 0, width: 10, height: 20 });
    const box = computeManipulationBox(node, object);

    expect(localRotateHandlePoint(box, 24)).toEqual({ x: 5, y: -24 });
  });
});

describe("localToParent", () => {
  it("sin rotación, el punto local se traslada directamente por el pivote", () => {
    const object = buildRectangle("rect_1", { transform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 100, y: 200, width: 10, height: 10 });
    const box = computeManipulationBox(node, object);

    expect(localToParent(box, { x: 5, y: -3 })).toEqual({ x: 105, y: 197 });
  });

  it("con rotación de 90°, un punto local 'arriba' del pivote termina a la derecha", () => {
    const object = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } });
    const node = new Konva.Rect({ x: 0, y: 0, width: 10, height: 10, rotation: 90 });
    const box = computeManipulationBox(node, object);

    const result = localToParent(box, { x: 0, y: -10 });
    expect(result.x).toBeCloseTo(10, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });
});
