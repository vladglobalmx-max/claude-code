import { describe, expect, it } from "vitest";
import { FAMILY_SAFE_MARGIN_MM, getFamilySafeMarginMm, type VisualFamily } from "./styleSystem.js";

const ALL_FAMILIES: VisualFamily[] = [
  "artesanal-calido",
  "lujo-silencioso",
  "audaz-grafico",
  "tecnico-funcional",
  "elegante-personal",
  "impacto-comercial",
];

describe("FAMILY_SAFE_MARGIN_MM / getFamilySafeMarginMm", () => {
  it("define un margen para las 6 familias del Design Language Guide", () => {
    for (const family of ALL_FAMILIES) {
      expect(typeof FAMILY_SAFE_MARGIN_MM[family]).toBe("number");
      expect(getFamilySafeMarginMm(family)).toBe(FAMILY_SAFE_MARGIN_MM[family]);
    }
  });

  it("Lujo Silencioso tiene el margen máximo del sistema (§5.3)", () => {
    const max = Math.max(...ALL_FAMILIES.map((f) => FAMILY_SAFE_MARGIN_MM[f]));
    expect(FAMILY_SAFE_MARGIN_MM["lujo-silencioso"]).toBe(max);
  });

  it("Audaz Gráfico / Técnico Funcional / Impacto Comercial usan el mínimo funcional (3mm, igual al área segura)", () => {
    expect(FAMILY_SAFE_MARGIN_MM["audaz-grafico"]).toBe(3);
    expect(FAMILY_SAFE_MARGIN_MM["tecnico-funcional"]).toBe(3);
    expect(FAMILY_SAFE_MARGIN_MM["impacto-comercial"]).toBe(3);
  });
});
