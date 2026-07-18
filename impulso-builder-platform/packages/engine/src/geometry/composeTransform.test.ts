import { describe, expect, it } from "vitest";
import { composeChildTransformIntoParent } from "./composeTransform.js";

describe("composeChildTransformIntoParent", () => {
  it("con un parent identidad, el child queda exactamente igual", () => {
    const parent = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const child = { x: 5, y: 10, rotation: 30, scaleX: 2, scaleY: 3 };

    expect(composeChildTransformIntoParent(parent, child)).toEqual(child);
  });

  it("un parent con solo traslación desplaza la posición del child, sin afectar rotación/escala", () => {
    const parent = { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 };
    const child = { x: 5, y: 10, rotation: 15, scaleX: 2, scaleY: 2 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result).toEqual({ x: 105, y: 210, rotation: 15, scaleX: 2, scaleY: 2 });
  });

  it("un parent con solo escala escala la posición del child y multiplica su propia escala", () => {
    const parent = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 3 };
    const child = { x: 5, y: 4, rotation: 0, scaleX: 1, scaleY: 1 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result).toEqual({ x: 10, y: 12, rotation: 0, scaleX: 2, scaleY: 3 });
  });

  it("un parent con solo rotación de 90° rota la posición del child alrededor del origen", () => {
    const parent = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    const child = { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(10, 10);
    expect(result.rotation).toBe(90);
  });

  it("combina traslación + rotación + escala del parent correctamente (verificado a mano)", () => {
    const parent = { x: 10, y: 20, rotation: 90, scaleX: 2, scaleY: 3 };
    const child = { x: 5, y: 4, rotation: 30, scaleX: 1, scaleY: 1 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result.x).toBeCloseTo(-2, 10);
    expect(result.y).toBeCloseTo(30, 10);
    expect(result.rotation).toBeCloseTo(120, 10);
    expect(result.scaleX).toBeCloseTo(2, 10);
    expect(result.scaleY).toBeCloseTo(3, 10);
  });

  it("normaliza la rotación resultante a [0, 360)", () => {
    const parent = { x: 0, y: 0, rotation: 300, scaleX: 1, scaleY: 1 };
    const child = { x: 0, y: 0, rotation: 250, scaleX: 1, scaleY: 1 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result.rotation).toBeCloseTo(190, 10); // (300+250) % 360 = 190
  });

  it("normaliza correctamente cuando la suma es exactamente un múltiplo de 360", () => {
    const parent = { x: 0, y: 0, rotation: 180, scaleX: 1, scaleY: 1 };
    const child = { x: 0, y: 0, rotation: 180, scaleX: 1, scaleY: 1 };

    const result = composeChildTransformIntoParent(parent, child);

    expect(result.rotation).toBe(0);
  });
});
