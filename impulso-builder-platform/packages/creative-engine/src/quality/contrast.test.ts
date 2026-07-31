import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, requiredTextContrast } from "./contrast.js";

describe("contrastRatio", () => {
  it("negro sobre blanco es el contraste máximo (21:1)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("un color contra sí mismo es el mínimo (1:1)", () => {
    expect(contrastRatio("#8a6d3b", "#8a6d3b")).toBeCloseTo(1, 5);
  });

  it("es simétrico", () => {
    expect(contrastRatio("#111111", "#eeeeee")).toBeCloseTo(contrastRatio("#eeeeee", "#111111"), 5);
  });
});

describe("requiredTextContrast", () => {
  it("exige 4.5:1 para texto normal y 3:1 para texto grande (≥24px)", () => {
    expect(requiredTextContrast(13)).toBe(4.5);
    expect(requiredTextContrast(24)).toBe(3);
    expect(requiredTextContrast(48)).toBe(3);
  });
});

describe("ensureContrast", () => {
  it("no toca un color que ya cumple el mínimo", () => {
    expect(ensureContrast("#1c1917", "#f2ede4", 4.5)).toBe("#1c1917");
  });

  it("oscurece un color insuficiente hasta alcanzar el mínimo exigido", () => {
    const background = "#f2ede4";
    const adjusted = ensureContrast("#b08d57", background, 4.5);
    expect(contrastRatio(adjusted, background)).toBeGreaterThanOrEqual(4.5);
  });
});
