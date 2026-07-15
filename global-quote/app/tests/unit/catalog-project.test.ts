import { describe, expect, it } from "vitest";

import { projectProduct, type ProductForProjection } from "@/lib/catalog/project";

const baseProduct: ProductForProjection = {
  id: "product-1",
  internalSku: "GFB-ENJ-004",
  name: "Enjuague Bucal Profesional 1L",
  shortDescription: null,
  uom: "PZA",
  status: "ACTIVE",
  categoryName: "Enjuagues con flúor",
  listPrice: 70,
  landedCost: 59,
  minMarginPct: 25,
};

describe("projectProduct (docs/ARCHITECTURE.md §3.1 frontera de costos)", () => {
  it("never includes landedCost for a VENDEDOR", () => {
    const projected = projectProduct(baseProduct, "VENDEDOR");
    expect(projected.landedCost).toBeNull();
    expect(projected.listPrice).toBe(70);
  });

  it("does not expose margin percentage to a VENDEDOR either", () => {
    const projected = projectProduct(baseProduct, "VENDEDOR");
    expect(projected.marginPct).toBeNull();
  });

  it("includes landedCost and margin for SUPER_ADMIN", () => {
    const projected = projectProduct(baseProduct, "SUPER_ADMIN");
    expect(projected.landedCost).toBe(59);
    expect(projected.marginPct).toBeCloseTo(15.71, 2);
  });

  it("flags the seeded stale price (GFB-ENJ-004) as below the minimum margin", () => {
    const projected = projectProduct(baseProduct, "ADMINISTRACION");
    expect(projected.belowMinMargin).toBe(true);
  });

  it("GERENTE_VENTAS sees margin percentage but not landed cost", () => {
    const projected = projectProduct(baseProduct, "GERENTE_VENTAS");
    expect(projected.landedCost).toBeNull();
    expect(projected.marginPct).toBeCloseTo(15.71, 2);
  });

  it("does not flag a healthy margin as below minimum", () => {
    const healthy: ProductForProjection = { ...baseProduct, listPrice: 100 };
    const projected = projectProduct(healthy, "SUPER_ADMIN");
    expect(projected.belowMinMargin).toBe(false);
  });
});
