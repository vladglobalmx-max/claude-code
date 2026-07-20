import { describe, expect, it } from "vitest";
import { clampPointToStageBounds } from "./interactiveBounds.js";

const STAGE = { width: 200, height: 100 };

describe("clampPointToStageBounds", () => {
  it("no recorta cuando el punto deseado ya cabe dentro del Stage", () => {
    const result = clampPointToStageBounds({ x: 50, y: 50 }, { x: 50, y: 30 }, STAGE, 4);
    expect(result).toEqual({ x: 50, y: 30 });
  });

  it("recorta un punto que cae por encima del borde superior (Y negativa) — el bug de Fase 7.3.5", () => {
    // anchor a Y=10 (objeto pegado casi al borde superior), handle deseado 24px arriba -> Y=-14 (fuera del Stage).
    const result = clampPointToStageBounds({ x: 50, y: 10 }, { x: 50, y: -14 }, STAGE, 4);
    expect(result.x).toBe(50);
    expect(result.y).toBe(4); // padding: el borde superior interactivo real es Y=4, no Y=0
  });

  it("el handle nunca se oculta: en el peor caso queda exactamente sobre el ancla, no en NaN/undefined", () => {
    // anchor YA está en el borde superior interactivo — no hay ningún margen para el offset.
    const result = clampPointToStageBounds({ x: 50, y: 4 }, { x: 50, y: -20 }, STAGE, 4);
    expect(result).toEqual({ x: 50, y: 4 });
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
  });

  it("funciona para un ángulo arbitrario, no solo 'arriba' (object rotado)", () => {
    // Handle deseado hacia la izquierda-arriba, fuera del Stage en X e Y a la vez.
    const result = clampPointToStageBounds({ x: 6, y: 6 }, { x: -20, y: -20 }, STAGE, 4);
    // El vector es (-26,-26); el límite más restrictivo es X (necesita t tal que 6+(-26)*t=4 -> t=2/26).
    const t = 2 / 26;
    expect(result.x).toBeCloseTo(6 - 26 * t, 10);
    expect(result.y).toBeCloseTo(6 - 26 * t, 10);
    expect(result.x).toBeGreaterThanOrEqual(4 - 1e-9);
    expect(result.y).toBeGreaterThanOrEqual(4 - 1e-9);
  });

  it("recorta contra el borde derecho/inferior igual que contra el superior/izquierdo", () => {
    const result = clampPointToStageBounds({ x: 190, y: 90 }, { x: 220, y: 120 }, STAGE, 4);
    expect(result.x).toBeCloseTo(196, 9);
    expect(result.y).toBeLessThanOrEqual(96 + 1e-9);
  });

  it("si el ancla mismo ya está fuera del Stage, se devuelve sin cambios (limitación residual documentada)", () => {
    const result = clampPointToStageBounds({ x: -50, y: -50 }, { x: -74, y: -50 }, STAGE, 4);
    expect(result).toEqual({ x: -50, y: -50 });
  });

  it("nunca produce NaN/Infinity para un vector puramente horizontal o vertical", () => {
    const horizontal = clampPointToStageBounds({ x: 50, y: 50 }, { x: 300, y: 50 }, STAGE, 4);
    expect(Number.isFinite(horizontal.x)).toBe(true);
    expect(horizontal.y).toBe(50);

    const vertical = clampPointToStageBounds({ x: 50, y: 50 }, { x: 50, y: -100 }, STAGE, 4);
    expect(Number.isFinite(vertical.y)).toBe(true);
    expect(vertical.x).toBe(50);
  });

  it("un desiredPoint idéntico al anchor (offset 0) devuelve el anchor", () => {
    const result = clampPointToStageBounds({ x: 50, y: 50 }, { x: 50, y: 50 }, STAGE, 4);
    expect(result).toEqual({ x: 50, y: 50 });
  });
});
