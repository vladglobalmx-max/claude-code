import { describe, expect, it } from "vitest";
import { resolveCategoryFormInit } from "./catalog-form";

describe("resolveCategoryFormInit", () => {
  it("BUG REPRODUCIDO Y CORREGIDO: producto nuevo (sin categoría) con categorías existentes selecciona la primera de forma real, no solo visual", () => {
    const result = resolveCategoryFormInit("", ["Luz LED Grúa Viajera", "Blue Spot"]);
    expect(result.isNewCategory).toBe(false);
    expect(result.category).toBe("Luz LED Grúa Viajera");
    expect(result.newCategory).toBe("");
  });

  it("editar un producto existente conserva su categoría actual (no cae a la primera de la lista)", () => {
    const result = resolveCategoryFormInit("Blue Spot", ["Luz LED Grúa Viajera", "Blue Spot"]);
    expect(result.isNewCategory).toBe(false);
    expect(result.category).toBe("Blue Spot");
  });

  it("sin categorías todavía en el catálogo, arranca en modo '+ Nueva categoría'", () => {
    const result = resolveCategoryFormInit("", []);
    expect(result.isNewCategory).toBe(true);
    expect(result.category).toBe("");
    expect(result.newCategory).toBe("");
  });

  it("editar un producto cuya categoría ya no está en la lista arranca en modo '+ Nueva categoría' con el valor original precargado", () => {
    const result = resolveCategoryFormInit("Categoría Descontinuada", ["Luz LED Grúa Viajera"]);
    expect(result.isNewCategory).toBe(true);
    expect(result.newCategory).toBe("Categoría Descontinuada");
  });
});
