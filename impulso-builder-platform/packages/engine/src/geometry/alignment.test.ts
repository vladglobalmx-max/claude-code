import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { computeRotatedBoundingBox } from "./boundingBox.js";
import {
  alignLeft,
  alignRight,
  alignCenterHorizontal,
  alignTop,
  alignBottom,
  alignCenterVertical,
  distributeHorizontal,
  distributeVertical,
  centerOnPageHorizontal,
  centerOnPageVertical,
  type AlignmentTarget,
} from "./alignment.js";

/** Object rectangular sin rotar: box == { x, y, x+width, y+height }. */
function rect(id: string, x: number, y: number, width: number, height: number): AlignmentTarget {
  return {
    objectId: ObjectIdSchema.parse(id),
    box: { minX: x, minY: y, maxX: x + width, maxY: y + height },
    transform: { x, y },
  };
}

describe("alignLeft / alignRight / alignCenterHorizontal", () => {
  it("alignLeft mueve cada object a compartir el borde izquierdo de la caja envolvente conjunta", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10), rect("c", -20, 0, 10, 10)];
    const patches = alignLeft(targets);
    // El borde izquierdo de la envolvente conjunta es -20 (el de "c").
    expect(patches).toEqual(
      expect.arrayContaining([
        { objectId: "a", transform: { x: -20 } },
        { objectId: "b", transform: { x: -20 } },
      ]),
    );
    // "c" ya está alineado (es el propio borde) — no genera patch.
    expect(patches.find((p) => p.objectId === "c")).toBeUndefined();
  });

  it("alignRight mueve cada object a compartir el borde derecho de la caja envolvente conjunta", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 50, 0, 20, 10)];
    const patches = alignRight(targets);
    // Borde derecho conjunto: max(10, 70) = 70. "a" (ancho 10) debe mover su x a 60.
    expect(patches).toEqual([{ objectId: "a", transform: { x: 60 } }]);
  });

  it("alignCenterHorizontal centra cada object en el centro horizontal de la caja envolvente conjunta", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 40, 0, 10, 10)];
    // Envolvente conjunta: minX=0, maxX=50 -> centro=25.
    const patches = alignCenterHorizontal(targets);
    expect(patches).toEqual(
      expect.arrayContaining([
        { objectId: "a", transform: { x: 20 } }, // centro de "a" pasa a 25 -> x = 25 - 10/2 = 20
        { objectId: "b", transform: { x: 20 } }, // centro de "b" pasa a 25 -> x = 25 - 10/2 = 20
      ]),
    );
  });

  it("no genera ningún patch cuando la selección ya está alineada (cero entradas de historial)", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 0, 30, 10, 10)];
    expect(alignLeft(targets)).toEqual([]);
  });

  it("con un arreglo vacío, no genera ningún patch (nada seleccionado)", () => {
    expect(alignLeft([])).toEqual([]);
    expect(alignTop([])).toEqual([]);
  });
});

describe("alignTop / alignBottom / alignCenterVertical", () => {
  it("alignTop/alignBottom/alignCenterVertical replican la misma lógica en el eje Y", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 0, 50, 10, 20)];
    expect(alignTop(targets)).toEqual([{ objectId: "b", transform: { y: 0 } }]);
    expect(alignBottom(targets)).toEqual([{ objectId: "a", transform: { y: 60 } }]);
    const centerPatches = alignCenterVertical(targets);
    expect(centerPatches.length).toBeGreaterThan(0);
  });
});

describe("distributeHorizontal / distributeVertical", () => {
  it("con menos de 3 objects, no hace nada (sin espacio 'entre' bien definido)", () => {
    expect(distributeHorizontal([rect("a", 0, 0, 10, 10), rect("b", 100, 0, 10, 10)])).toEqual([]);
    expect(distributeHorizontal([rect("a", 0, 0, 10, 10)])).toEqual([]);
    expect(distributeVertical([rect("a", 0, 0, 10, 10), rect("b", 0, 100, 10, 10)])).toEqual([]);
  });

  it("distribuye el espacio uniformemente entre los bordes, conservando los extremos fijos", () => {
    // a: [0,10], b: [40,50] (ancho 10), c: [100,110]. Espacio entre a.maxX(10) y c.minX(100) = 90.
    // Ancho de b = 10. Gap = (90 - 10) / 2 = 40. b debe quedar en minX = 10 + 40 = 50.
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 40, 0, 10, 10), rect("c", 100, 0, 10, 10)];
    const patches = distributeHorizontal(targets);
    expect(patches).toEqual([{ objectId: "b", transform: { x: 50 } }]);
    // Los extremos nunca se tocan.
    expect(patches.find((p) => p.objectId === "a")).toBeUndefined();
    expect(patches.find((p) => p.objectId === "c")).toBeUndefined();
  });

  it("no genera patch si el espaciado del medio ya es uniforme", () => {
    // a:[0,10], b:[50,60] (centrado entre 10 y 100 con gap 40 en ambos lados), c:[100,110].
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10), rect("c", 100, 0, 10, 10)];
    expect(distributeHorizontal(targets)).toEqual([]);
  });

  it("es determinista por posición visual actual, sin importar el orden de entrada", () => {
    const inOrder = [rect("a", 0, 0, 10, 10), rect("b", 40, 0, 10, 10), rect("c", 100, 0, 10, 10)];
    const shuffled = [inOrder[2]!, inOrder[0]!, inOrder[1]!];
    expect(distributeHorizontal(shuffled)).toEqual(distributeHorizontal(inOrder));
  });

  it("con dos objects en la misma coordenada primaria, desempata de forma determinista por id", () => {
    const targets = [rect("z", 40, 0, 10, 10), rect("m", 40, 0, 10, 10), rect("a", 100, 0, 10, 10)];
    // "m" < "z" alfabéticamente -> "m" se trata como el "medio" antes que "z" en el desempate,
    // pero como ambos comparten minX=40 y solo uno puede ser "el del medio" real (hay 3 objects,
    // sorted[0] es el primero, sorted[2] el último) el resultado debe ser reproducible.
    const first = distributeHorizontal(targets);
    const second = distributeHorizontal([...targets].reverse());
    expect(first).toEqual(second);
  });

  it("caso límite: espacio insuficiente produce superposición determinista, no falla", () => {
    // a:[0,10], b:[12,32] (ancho 20), c:[14,24] -> apenas espacio entre a y c.
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 12, 0, 20, 10), rect("c", 14, 0, 10, 10)];
    expect(() => distributeHorizontal(targets)).not.toThrow();
    const patches = distributeHorizontal(targets);
    expect(Array.isArray(patches)).toBe(true);
  });

  it("distributeVertical replica la misma lógica en el eje Y", () => {
    const targets = [rect("a", 0, 0, 10, 10), rect("b", 0, 40, 10, 10), rect("c", 0, 100, 10, 10)];
    const patches = distributeVertical(targets);
    expect(patches).toEqual([{ objectId: "b", transform: { y: 50 } }]);
  });
});

describe("centerOnPageHorizontal / centerOnPageVertical", () => {
  it("centra un único object horizontalmente respecto del ancho de página dado", () => {
    const target = rect("a", 0, 0, 20, 10);
    const patches = centerOnPageHorizontal(target, 100);
    expect(patches).toEqual([{ objectId: "a", transform: { x: 40 } }]);
  });

  it("centra un único object verticalmente respecto del alto de página dado", () => {
    const target = rect("a", 0, 0, 20, 10);
    const patches = centerOnPageVertical(target, 50);
    expect(patches).toEqual([{ objectId: "a", transform: { y: 20 } }]);
  });

  it("no genera patch si el object ya está centrado", () => {
    const target = rect("a", 40, 0, 20, 10);
    expect(centerOnPageHorizontal(target, 100)).toEqual([]);
    expect(centerOnPageVertical(rect("b", 0, 15, 10, 10), 40)).toEqual([]);
  });
});

describe("integración con computeRotatedBoundingBox: objects rotados se alinean por su caja real, no por transform.x/y crudo", () => {
  it("un rectángulo rotado 90° se alinea usando su AABB rotado, no su x/y sin rotar", () => {
    // Rectángulo 40x10 en (0,0), rotado 90° alrededor de su esquina superior
    // izquierda: su AABB real es 10 de ancho x 40 de alto, con minX negativo
    // (gira "hacia atrás" en X) — muy distinto de su transform.x/y crudo.
    const rotatedBox = computeRotatedBoundingBox({
      pivot: { x: 0, y: 0 },
      originOffset: { x: 0, y: 0 },
      width: 40,
      height: 10,
      rotationDegrees: 90,
    });
    const rotatedTarget: AlignmentTarget = {
      objectId: ObjectIdSchema.parse("rotated"),
      box: rotatedBox,
      transform: { x: 0, y: 0 },
    };
    const straightTarget = rect("straight", 100, 0, 10, 10);

    const patches = alignLeft([rotatedTarget, straightTarget]);
    // La caja envolvente conjunta usa minX real del rotado (negativo), no 0.
    const expectedUnionMinX = Math.min(rotatedBox.minX, 100);
    const straightPatch = patches.find((p) => p.objectId === "straight");
    expect(straightPatch?.transform.x).toBeCloseTo(expectedUnionMinX, 6);
  });
});
