import { describe, expect, it } from "vitest";
import { computeRotatedTransform, ROTATION_SNAP_INCREMENT_DEGREES } from "./rotateMath.js";

describe("computeRotatedTransform — normalización de ángulo", () => {
  it("un ángulo ya dentro de [0, 360) se conserva sin cambios", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: 45 })).toEqual({ rotation: 45 });
  });

  it("0 se conserva como 0", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: 0 })).toEqual({ rotation: 0 });
  });

  it("un ángulo negativo se normaliza sumando 360", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: -90 })).toEqual({ rotation: 270 });
  });

  it("un ángulo negativo grande se normaliza correctamente (varias vueltas)", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: -450 })).toEqual({ rotation: 270 });
  });

  it("un ángulo mayor a 360 se normaliza restando vueltas completas", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: 405 })).toEqual({ rotation: 45 });
  });

  it("exactamente 360 se normaliza a 0", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: 360 })).toEqual({ rotation: 0 });
  });

  it("exactamente -360 se normaliza a 0", () => {
    expect(computeRotatedTransform({ pointerAngleDegrees: -360 })).toEqual({ rotation: 0 });
  });
});

describe("computeRotatedTransform — snap a incrementos de 15°", () => {
  it("redondea hacia abajo cuando está más cerca del incremento inferior", () => {
    const result = computeRotatedTransform({ pointerAngleDegrees: 7, snapToIncrement: true });
    expect(result).toEqual({ rotation: 0 });
  });

  it("redondea hacia arriba cuando está más cerca del incremento superior", () => {
    const result = computeRotatedTransform({ pointerAngleDegrees: 41, snapToIncrement: true });
    expect(result).toEqual({ rotation: 45 });
  });

  it("un ángulo ya exacto en el incremento se conserva", () => {
    const result = computeRotatedTransform({ pointerAngleDegrees: 30, snapToIncrement: true });
    expect(result).toEqual({ rotation: 30 });
  });

  it("respeta ROTATION_SNAP_INCREMENT_DEGREES como la unidad de redondeo", () => {
    expect(ROTATION_SNAP_INCREMENT_DEGREES).toBe(15);
    const result = computeRotatedTransform({
      pointerAngleDegrees: ROTATION_SNAP_INCREMENT_DEGREES * 3 + 1,
      snapToIncrement: true,
    });
    expect(result).toEqual({ rotation: ROTATION_SNAP_INCREMENT_DEGREES * 3 });
  });

  it("snap combinado con normalización de ángulo negativo", () => {
    // -100 -> normaliza a 260 -> snap al múltiplo de 15 más cercano: 255 (dist 5) vs 270 (dist 10).
    const result = computeRotatedTransform({ pointerAngleDegrees: -100, snapToIncrement: true });
    expect(result).toEqual({ rotation: 255 });
  });

  it("snap que redondea exactamente a 360 se normaliza de vuelta a 0", () => {
    // 353 -> snap candidato 360 (dist 7) vs 345 (dist 8) -> redondea a 360 -> normaliza a 0.
    const result = computeRotatedTransform({ pointerAngleDegrees: 353, snapToIncrement: true });
    expect(result).toEqual({ rotation: 0 });
  });

  it("snapToIncrement=false explícito se comporta igual que omitirlo", () => {
    const result = computeRotatedTransform({ pointerAngleDegrees: 7, snapToIncrement: false });
    expect(result).toEqual({ rotation: 7 });
  });
});
