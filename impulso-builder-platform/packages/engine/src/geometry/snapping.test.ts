import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import type { BoundingBox } from "./boundingBox.js";
import {
  computeSnap,
  buildPageSnapCandidates,
  buildObjectSnapCandidates,
  type SnapCandidate,
  type SnapResult,
} from "./snapping.js";

function box(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return { minX, minY, maxX, maxY };
}

const TOLERANCE = 5;

describe("computeSnap — prioridad (Página > Objects > Grid)", () => {
  it("prefiere un candidato de página sobre un candidato de object a igual distancia", () => {
    // targetBox con borde izquierdo en x=101. Página ofrece start=100 (distancia 1);
    // un object también ofrece start=100 (misma distancia) — página debe ganar.
    const candidates: SnapCandidate[] = [
      { source: "page", axis: "x", value: 100, refPoint: "start" },
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
    });
    expect(result.x?.source).toBe("page");
    expect(result.x?.value).toBe(100);
  });

  it("cuando página no calza, cae a Objects", () => {
    const candidates: SnapCandidate[] = [
      { source: "page", axis: "x", value: 1000, refPoint: "start" },
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
    });
    expect(result.x?.source).toBe("object");
    expect(result.x?.objectId).toBe("obj_a");
  });

  it("cuando página y objects no calzan pero grid sí, cae a Grid", () => {
    const candidates: SnapCandidate[] = [
      { source: "page", axis: "x", value: 1000, refPoint: "start" },
      { source: "object", axis: "x", value: 1000, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
      grid: { size: 100, snapEnabled: true },
    });
    // borde izquierdo en 101 -> grid más cercano es 100 (distancia 1, dentro de tolerancia 5)
    expect(result.x?.source).toBe("grid");
    expect(result.x?.value).toBe(100);
  });

  it("no snapea a grid si snapEnabled es false, aunque el tamaño calce", () => {
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates: [],
      toleranceDocumentUnits: TOLERANCE,
      grid: { size: 100, snapEnabled: false },
    });
    expect(result.x).toBeUndefined();
  });

  it("no snapea ningún eje si nada calza dentro de tolerancia", () => {
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 1000, refPoint: "start" }];
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
    });
    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
  });
});

describe("computeSnap — desempate determinista", () => {
  it("dos objects a igual distancia: gana el de menor id (string compare)", () => {
    const candidates: SnapCandidate[] = [
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_z") },
      { source: "object", axis: "x", value: 102, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    // targetBox borde izquierdo en 101: distancia a "obj_z" (100) = 1, a "obj_a" (102) = 1 -> empate
    const result = computeSnap({
      targetBox: box(101, 0, 111, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
    });
    expect(result.x?.objectId).toBe("obj_a");
  });

  it("mismo candidato en dos puntos de referencia distintos: gana el de orden de refPoint más bajo (start < center < end)", () => {
    // targetBox: minX=95, maxX=105 (centro=100, start=95, end=105).
    // Un único candidato en value=100 puede calzar con "center" (distancia 0) directamente,
    // así que forzamos el empate real usando dos candidatos distintos a la misma distancia
    // pero que resuelven en refPoints distintos del target.
    const candidates: SnapCandidate[] = [
      { source: "page", axis: "x", value: 95, refPoint: "start" }, // distancia con target.start (95) = 0
      { source: "page", axis: "x", value: 105, refPoint: "end" }, // distancia con target.end (105) = 0
    ];
    const result = computeSnap({
      targetBox: box(95, 0, 105, 10),
      candidates,
      toleranceDocumentUnits: TOLERANCE,
    });
    expect(result.x?.refPoint).toBe("start");
  });

  it("múltiples objects con el mismo centro no oscilan: el resultado es determinista y estable entre llamadas", () => {
    const candidates: SnapCandidate[] = [
      { source: "object", axis: "x", value: 100, refPoint: "center", objectId: ObjectIdSchema.parse("obj_b") },
      { source: "object", axis: "x", value: 100, refPoint: "center", objectId: ObjectIdSchema.parse("obj_c") },
      { source: "object", axis: "x", value: 100, refPoint: "center", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const input = { targetBox: box(95, 0, 105, 10), candidates, toleranceDocumentUnits: TOLERANCE };
    const first = computeSnap(input);
    const second = computeSnap(input);
    expect(first.x?.objectId).toBe("obj_a");
    expect(second.x?.objectId).toBe("obj_a");
  });
});

describe("computeSnap — tolerancia", () => {
  it("calza justo en el borde de tolerancia", () => {
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 100, refPoint: "start" }];
    const result = computeSnap({
      targetBox: box(105, 0, 115, 10), // distancia exacta = tolerancia (5)
      candidates,
      toleranceDocumentUnits: 5,
    });
    expect(result.x?.value).toBe(100);
  });

  it("no calza justo pasando la tolerancia", () => {
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 100, refPoint: "start" }];
    const result = computeSnap({
      targetBox: box(105.01, 0, 115.01, 10),
      candidates,
      toleranceDocumentUnits: 5,
    });
    expect(result.x).toBeUndefined();
  });

  it("object ya alineado exactamente desde el inicio (distancia 0) calza", () => {
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 100, refPoint: "start" }];
    const result = computeSnap({
      targetBox: box(100, 0, 110, 10),
      candidates,
      toleranceDocumentUnits: 5,
    });
    expect(result.x?.value).toBe(100);
    expect(result.x?.delta).toBe(0);
  });
});

describe("computeSnap — hysteresis", () => {
  it("mantiene el snap anterior mientras el movimiento esté dentro de la tolerancia de salida (hysteresisMultiplier)", () => {
    const candidates: SnapCandidate[] = [
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const first = computeSnap({
      targetBox: box(100, 0, 110, 10),
      candidates,
      toleranceDocumentUnits: 5,
    });
    expect(first.x?.objectId).toBe("obj_a");

    // El puntero se movió a distancia 7 del candidato original (fuera de tolerancia de entrada,
    // 5, pero dentro de tolerancia de salida por defecto 5*1.5=7.5) -> debe seguir "enganchado".
    const second = computeSnap({
      targetBox: box(107, 0, 117, 10),
      candidates,
      toleranceDocumentUnits: 5,
      previousSnap: first,
    });
    expect(second.x?.objectId).toBe("obj_a");
    expect(second.x?.delta).toBe(100 - 107);
  });

  it("suelta el snap anterior una vez superada la tolerancia de salida", () => {
    const candidates: SnapCandidate[] = [
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const first = computeSnap({
      targetBox: box(100, 0, 110, 10),
      candidates,
      toleranceDocumentUnits: 5,
    });

    const second = computeSnap({
      targetBox: box(200, 0, 210, 10), // muy lejos, ni tolerancia de entrada ni de salida
      candidates,
      toleranceDocumentUnits: 5,
      previousSnap: first,
    });
    expect(second.x).toBeUndefined();
  });

  it("permite ajustar el hysteresisMultiplier", () => {
    const candidates: SnapCandidate[] = [
      { source: "object", axis: "x", value: 100, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const first = computeSnap({
      targetBox: box(100, 0, 110, 10),
      candidates,
      toleranceDocumentUnits: 5,
    });

    const second = computeSnap({
      targetBox: box(107, 0, 117, 10), // distancia 7 del candidato
      candidates,
      toleranceDocumentUnits: 5,
      previousSnap: first,
      hysteresisMultiplier: 1, // tolerancia de salida = 5 -> 7 ya no califica
    });
    expect(second.x).toBeUndefined();
  });
});

describe("computeSnap — eligibleRefPoints", () => {
  it("restringe qué puntos de referencia del target pueden participar (uso previsto: resize por handle)", () => {
    // Candidato de página en el borde derecho (value=200). El target tiene su
    // borde izquierdo (start) exactamente ahí también -> sin restricción, snapea por "start".
    // Con eligibleRefPoints.x = ["end"], debe ignorar "start" y no encontrar match.
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 200, refPoint: "end" }];
    const result = computeSnap({
      targetBox: box(200, 0, 210, 10), // start=200 calzaría si estuviera permitido
      candidates,
      toleranceDocumentUnits: 5,
      eligibleRefPoints: { x: ["end"] },
    });
    // target.end = 210, candidato = 200 -> distancia 10, fuera de tolerancia.
    expect(result.x).toBeUndefined();
  });

  it("con eligibleRefPoints incluyendo el refPoint correcto, sí calza", () => {
    const candidates: SnapCandidate[] = [{ source: "page", axis: "x", value: 210, refPoint: "end" }];
    const result = computeSnap({
      targetBox: box(200, 0, 210, 10),
      candidates,
      toleranceDocumentUnits: 5,
      eligibleRefPoints: { x: ["end"] },
    });
    expect(result.x?.value).toBe(210);
    expect(result.x?.refPoint).toBe("end");
  });
});

describe("computeSnap — ejes independientes", () => {
  it("X e Y se evalúan de forma independiente y pueden snapear a fuentes distintas", () => {
    const candidates: SnapCandidate[] = [
      { source: "page", axis: "x", value: 100, refPoint: "start" },
      { source: "object", axis: "y", value: 50, refPoint: "start", objectId: ObjectIdSchema.parse("obj_a") },
    ];
    const result = computeSnap({
      targetBox: box(100, 50, 110, 60),
      candidates,
      toleranceDocumentUnits: 5,
    });
    expect(result.x?.source).toBe("page");
    expect(result.y?.source).toBe("object");
  });
});

describe("buildPageSnapCandidates", () => {
  it("genera los 6 candidatos (start/center/end x X/Y) desde el tamaño de página", () => {
    const candidates = buildPageSnapCandidates(200, 100);
    expect(candidates).toHaveLength(6);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { source: "page", axis: "x", value: 0, refPoint: "start" },
        { source: "page", axis: "x", value: 100, refPoint: "center" },
        { source: "page", axis: "x", value: 200, refPoint: "end" },
        { source: "page", axis: "y", value: 0, refPoint: "start" },
        { source: "page", axis: "y", value: 50, refPoint: "center" },
        { source: "page", axis: "y", value: 100, refPoint: "end" },
      ]),
    );
  });
});

describe("buildObjectSnapCandidates", () => {
  it("genera los 6 candidatos desde un AABB, con objectId en todos", () => {
    const id = ObjectIdSchema.parse("obj_a");
    const candidates = buildObjectSnapCandidates(id, box(10, 20, 30, 60));
    expect(candidates).toHaveLength(6);
    expect(candidates.every((c) => c.objectId === id)).toBe(true);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { source: "object", axis: "x", value: 10, refPoint: "start", objectId: id },
        { source: "object", axis: "x", value: 20, refPoint: "center", objectId: id },
        { source: "object", axis: "x", value: 30, refPoint: "end", objectId: id },
        { source: "object", axis: "y", value: 20, refPoint: "start", objectId: id },
        { source: "object", axis: "y", value: 40, refPoint: "center", objectId: id },
        { source: "object", axis: "y", value: 60, refPoint: "end", objectId: id },
      ]),
    );
  });
});

describe("computeSnap — resultado exhaustivo (regression del contrato SnapResult)", () => {
  it("devuelve un objeto vacío ({}) cuando no hay snaps en ningún eje, no undefined ni null", () => {
    const result: SnapResult = computeSnap({
      targetBox: box(1000, 1000, 1010, 1010),
      candidates: [],
      toleranceDocumentUnits: 5,
    });
    expect(result).toEqual({});
  });
});
