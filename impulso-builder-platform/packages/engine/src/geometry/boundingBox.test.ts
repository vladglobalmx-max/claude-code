import { describe, expect, it } from "vitest";
import { computeRotatedBoundingBox, unionBoundingBox } from "./boundingBox.js";

describe("computeRotatedBoundingBox", () => {
  it("sin rotación, el AABB es la caja tal cual (pivote esquina superior izquierda)", () => {
    const box = computeRotatedBoundingBox({
      pivot: { x: 10, y: 20 },
      originOffset: { x: 0, y: 0 },
      width: 30,
      height: 40,
      rotationDegrees: 0,
    });
    expect(box).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });

  it("con originOffset (ej. Ellipse, pivote en el centro), desplaza la caja antes de rotar", () => {
    const box = computeRotatedBoundingBox({
      pivot: { x: 50, y: 50 },
      originOffset: { x: -20, y: -10 },
      width: 40,
      height: 20,
      rotationDegrees: 0,
    });
    expect(box).toEqual({ minX: 30, minY: 40, maxX: 70, maxY: 60 });
  });

  it("rotación de 90° intercambia ancho/alto del AABB (cuadrado no cuadrado)", () => {
    const box = computeRotatedBoundingBox({
      pivot: { x: 0, y: 0 },
      originOffset: { x: 0, y: 0 },
      width: 100,
      height: 20,
      rotationDegrees: 90,
    });
    expect(box.maxX - box.minX).toBeCloseTo(20, 6);
    expect(box.maxY - box.minY).toBeCloseTo(100, 6);
  });

  it("rotación de 45° produce el AABB diagonal esperado (caso conocido: cuadrado unitario)", () => {
    const box = computeRotatedBoundingBox({
      pivot: { x: 0, y: 0 },
      originOffset: { x: 0, y: 0 },
      width: 10,
      height: 10,
      rotationDegrees: 45,
    });
    // Un cuadrado de lado 10 rotado 45° tiene una diagonal de 10*sqrt(2).
    expect(box.maxX - box.minX).toBeCloseTo(10 * Math.sqrt(2), 6);
    expect(box.maxY - box.minY).toBeCloseTo(10 * Math.sqrt(2), 6);
  });

  it("rotación de 360° es equivalente a 0° (normalización implícita del seno/coseno)", () => {
    const a = computeRotatedBoundingBox({
      pivot: { x: 5, y: 5 },
      originOffset: { x: 0, y: 0 },
      width: 30,
      height: 15,
      rotationDegrees: 0,
    });
    const b = computeRotatedBoundingBox({
      pivot: { x: 5, y: 5 },
      originOffset: { x: 0, y: 0 },
      width: 30,
      height: 15,
      rotationDegrees: 360,
    });
    expect(b.minX).toBeCloseTo(a.minX, 6);
    expect(b.minY).toBeCloseTo(a.minY, 6);
    expect(b.maxX).toBeCloseTo(a.maxX, 6);
    expect(b.maxY).toBeCloseTo(a.maxY, 6);
  });

  it("rotación negativa gira en sentido contrario de forma consistente", () => {
    const positive = computeRotatedBoundingBox({
      pivot: { x: 0, y: 0 },
      originOffset: { x: 0, y: 0 },
      width: 20,
      height: 10,
      rotationDegrees: 30,
    });
    const negative = computeRotatedBoundingBox({
      pivot: { x: 0, y: 0 },
      originOffset: { x: 0, y: 0 },
      width: 20,
      height: 10,
      rotationDegrees: -330, // equivalente matemático de 30°
    });
    expect(negative.minX).toBeCloseTo(positive.minX, 6);
    expect(negative.maxY).toBeCloseTo(positive.maxY, 6);
  });
});

describe("unionBoundingBox", () => {
  it("con una sola caja, devuelve esa misma caja", () => {
    const box = { minX: 1, minY: 2, maxX: 3, maxY: 4 };
    expect(unionBoundingBox([box])).toEqual(box);
  });

  it("con varias cajas, devuelve la envolvente que las contiene a todas", () => {
    const result = unionBoundingBox([
      { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      { minX: -5, minY: 20, maxX: 5, maxY: 30 },
      { minX: 8, minY: -3, maxX: 12, maxY: 2 },
    ]);
    expect(result).toEqual({ minX: -5, minY: -3, maxX: 12, maxY: 30 });
  });

  it("con cajas superpuestas, la envolvente sigue siendo correcta", () => {
    const result = unionBoundingBox([
      { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      { minX: 5, minY: 5, maxX: 15, maxY: 15 },
    ]);
    expect(result).toEqual({ minX: 0, minY: 0, maxX: 15, maxY: 15 });
  });

  it("lanza si se le da un arreglo vacío (caso de programación, no de uso normal)", () => {
    expect(() => unionBoundingBox([])).toThrow();
  });
});
