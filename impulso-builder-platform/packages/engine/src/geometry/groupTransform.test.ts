import { describe, expect, it } from "vitest";
import { ObjectIdSchema, type Transform } from "@impulso/document-schema";
import {
  translateGroupMembers,
  computeGroupResize,
  computeGroupRotation,
  computeGroupUnionBox,
  type GroupMember,
} from "./groupTransform.js";

function identityTransform(overrides: Partial<Transform> = {}): Transform {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...overrides };
}

/** Member rectangular sin rotar: box == { x, y, x+width, y+height }, mismo
 * criterio que `rect()` en alignment.test.ts. */
function member(id: string, x: number, y: number, width: number, height: number, extra: Partial<Transform> = {}): GroupMember {
  return {
    objectId: ObjectIdSchema.parse(id),
    box: { minX: x, minY: y, maxX: x + width, maxY: y + height },
    transform: identityTransform({ x, y, ...extra }),
  };
}

describe("translateGroupMembers", () => {
  it("traslada cada member por el mismo delta, preservando rotación/escala", () => {
    const members = [
      member("a", 0, 0, 10, 10),
      member("b", 50, 20, 5, 5, { rotation: 45, scaleX: 2 }),
    ];
    const patches = translateGroupMembers(members, { x: 10, y: -5 });
    expect(patches).toEqual([
      { objectId: "a", transform: { x: 10, y: -5 } },
      { objectId: "b", transform: { x: 60, y: 15 } },
    ]);
  });

  it("delta cero produce patches que no cambian nada (sin-op detectable por comparación)", () => {
    const members = [member("a", 3, 4, 10, 10)];
    const patches = translateGroupMembers(members, { x: 0, y: 0 });
    expect(patches).toEqual([{ objectId: "a", transform: { x: 3, y: 4 } }]);
  });
});

describe("computeGroupUnionBox", () => {
  it("calcula la envolvente conjunta de todos los members", () => {
    const members = [member("a", 0, 0, 10, 10), member("b", 50, -20, 10, 10)];
    expect(computeGroupUnionBox(members)).toEqual({ minX: 0, minY: -20, maxX: 60, maxY: 10 });
  });
});

describe("computeGroupResize", () => {
  it("arrastrar bottom-right escala el grupo desde el ancla top-left (sin rotación: exacto)", () => {
    const members = [member("a", 0, 0, 10, 10), member("b", 20, 0, 10, 10)];
    const unionBoxInitial = computeGroupUnionBox(members); // {0,0,30,10}
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "bottom-right",
      pointerDelta: { x: 30, y: 10 }, // ancho 30->60 (x2), alto 10->20 (x2)
    });
    // "a" pivote (0,0) respecto del ancla (0,0) no se mueve; escala x2.
    expect(patches).toEqual(
      expect.arrayContaining([
        { objectId: "a", transform: { x: 0, y: 0, scaleX: 2, scaleY: 2 } },
        // "b" pivote (20,0): 0 + (20-0)*2 = 40
        { objectId: "b", transform: { x: 40, y: 0, scaleX: 2, scaleY: 2 } },
      ]),
    );
  });

  it("arrastrar top-left usa el ancla opuesta (bottom-right) y no la mueve", () => {
    const members = [member("a", 0, 0, 10, 10)];
    const unionBoxInitial = computeGroupUnionBox(members); // {0,0,10,10}
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "top-left",
      pointerDelta: { x: -5, y: -5 }, // widthDelta = -(-5) = 5 -> newWidth 15; mismo para height
    });
    // Ancla = maxX/maxY = (10,10). Pivote (0,0) -> 10 + (0-10)*(15/10) = 10 - 15 = -5
    expect(patches).toEqual([{ objectId: "a", transform: { x: -5, y: -5, scaleX: 1.5, scaleY: 1.5 } }]);
  });

  it("Shift (maintainAspectRatio) conserva la proporción del conjunto", () => {
    const members = [member("a", 0, 0, 20, 10)];
    const unionBoxInitial = computeGroupUnionBox(members); // ancho 20, alto 10, ratio 2
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "bottom-right",
      pointerDelta: { x: 20, y: 0 }, // solo ancho cambia crudo: 20->40
      maintainAspectRatio: true,
    });
    // widthDelta=20 (cambia), heightDelta=0 (no cambia) -> newHeight = newWidth/ratio = 40/2 = 20
    expect(patches[0]!.transform.scaleY).toBeCloseTo(2, 10); // 20/10
    expect(patches[0]!.transform.scaleX).toBeCloseTo(2, 10); // 40/20
  });

  it("respeta MIN_RESIZE_SIZE del conjunto — nunca colapsa a 0 ni negativo", () => {
    const members = [member("a", 0, 0, 10, 10)];
    const unionBoxInitial = computeGroupUnionBox(members);
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "bottom-right",
      pointerDelta: { x: -1000, y: -1000 },
    });
    expect(patches[0]!.transform.scaleX).toBeGreaterThan(0);
    expect(patches[0]!.transform.scaleY).toBeGreaterThan(0);
    expect(Number.isFinite(patches[0]!.transform.scaleX)).toBe(true);
  });

  it("caja inicial de ancho/alto ~0 (members superpuestos) no produce NaN/Infinity", () => {
    const members = [member("a", 5, 5, 0, 0), member("b", 5, 5, 0, 0)];
    const unionBoxInitial = computeGroupUnionBox(members); // {5,5,5,5}
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "bottom-right",
      pointerDelta: { x: 50, y: 50 },
    });
    for (const patch of patches) {
      expect(Number.isFinite(patch.transform.scaleX!)).toBe(true);
      expect(Number.isFinite(patch.transform.scaleY!)).toBe(true);
      expect(Number.isNaN(patch.transform.scaleX)).toBe(false);
    }
  });

  it("preserva la rotación individual de cada member (nunca la toca)", () => {
    const members = [member("a", 0, 0, 10, 10, { rotation: 33 })];
    const unionBoxInitial = computeGroupUnionBox(members);
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "right",
      pointerDelta: { x: 10, y: 0 },
    });
    expect(patches[0]!.transform.rotation).toBeUndefined(); // no se incluye -> merge preserva el valor existente
  });

  it("scaleX/scaleY inicial negativo se multiplica sin producir NaN (el schema lo permite)", () => {
    const members = [member("a", 0, 0, 10, 10, { scaleX: -1 })];
    const unionBoxInitial = computeGroupUnionBox(members);
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "right",
      pointerDelta: { x: 10, y: 0 },
    });
    expect(Number.isFinite(patches[0]!.transform.scaleX!)).toBe(true);
  });

  it("handle lateral (no esquina) solo afecta un eje", () => {
    const members = [member("a", 0, 0, 10, 10)];
    const unionBoxInitial = computeGroupUnionBox(members);
    const patches = computeGroupResize({
      members,
      unionBoxInitial,
      handle: "right",
      pointerDelta: { x: 10, y: 999 }, // Y del puntero se ignora para un handle lateral horizontal
    });
    expect(patches[0]!.transform.scaleY).toBe(1);
    expect(patches[0]!.transform.scaleX).toBe(2);
  });
});

describe("computeGroupRotation", () => {
  it("rota cada member alrededor del centro conjunto y suma el delta a su rotación", () => {
    const members = [
      member("a", 10, 0, 0, 0, { rotation: 0 }), // pivote a la derecha del centro (0,0)
      member("b", 0, 0, 0, 0, { rotation: 20 }), // pivote EN el centro
    ];
    const patches = computeGroupRotation({ members, center: { x: 0, y: 0 }, deltaRotationDegrees: 90 });
    // (10,0) rotado 90° (sentido horario en espacio pantalla, mismo criterio que rotateMath.ts) -> (0,10)
    const a = patches.find((p) => p.objectId === "a")!;
    expect(a.transform.x).toBeCloseTo(0, 10);
    expect(a.transform.y).toBeCloseTo(10, 10);
    expect(a.transform.rotation).toBe(90);

    // "b" está exactamente en el centro -> su posición no cambia, solo su rotación acumula.
    const b = patches.find((p) => p.objectId === "b")!;
    expect(b.transform.x).toBeCloseTo(0, 10);
    expect(b.transform.y).toBeCloseTo(0, 10);
    expect(b.transform.rotation).toBe(110);
  });

  it("delta 360 vuelve a la posición/rotación original (módulo normalización)", () => {
    const members = [member("a", 10, 5, 0, 0, { rotation: 40 })];
    const patches = computeGroupRotation({ members, center: { x: 0, y: 0 }, deltaRotationDegrees: 360 });
    expect(patches[0]!.transform.x).toBeCloseTo(10, 9);
    expect(patches[0]!.transform.y).toBeCloseTo(5, 9);
    expect(patches[0]!.transform.rotation).toBe(40);
  });

  it("delta negativo normaliza el ángulo resultante a [0, 360)", () => {
    const members = [member("a", 0, 0, 0, 0, { rotation: 10 })];
    const patches = computeGroupRotation({ members, center: { x: 0, y: 0 }, deltaRotationDegrees: -30 });
    expect(patches[0]!.transform.rotation).toBeCloseTo(340, 9);
  });

  it("no depende de la rotación previa del member para calcular su nueva posición (exacto sin importar rotación individual)", () => {
    const a = member("a", 10, 0, 0, 0, { rotation: 0 });
    const b = member("b", 10, 0, 0, 0, { rotation: 275 });
    const patchesA = computeGroupRotation({ members: [a], center: { x: 0, y: 0 }, deltaRotationDegrees: 45 });
    const patchesB = computeGroupRotation({ members: [b], center: { x: 0, y: 0 }, deltaRotationDegrees: 45 });
    expect(patchesA[0]!.transform.x).toBeCloseTo(patchesB[0]!.transform.x!, 10);
    expect(patchesA[0]!.transform.y).toBeCloseTo(patchesB[0]!.transform.y!, 10);
  });
});
