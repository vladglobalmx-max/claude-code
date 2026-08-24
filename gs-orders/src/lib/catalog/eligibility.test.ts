import { describe, expect, it } from "vitest";
import {
  catalogProductsById,
  filterEligibleCatalogProducts,
  findIncompatibleItems,
  isProductEligibleForBusinessUnit,
  searchCatalogProducts,
  type EligibilitySource,
  type SearchableSource,
} from "./eligibility";

interface TestProduct extends EligibilitySource, SearchableSource {
  id: string;
}

function product(overrides: Partial<TestProduct> = {}): TestProduct {
  return {
    id: "prod-1",
    sku: "TP-0001",
    name: "Proyector LED Dual",
    model: "RT40076-2",
    brand: "Thunder LED Lights",
    businessUnitIds: [],
    ...overrides,
  };
}

const BU_A = "bu-a";
const BU_B = "bu-b";

describe("isProductEligibleForBusinessUnit", () => {
  it("TODAS (0 BU) es elegible para cualquier Business Unit", () => {
    expect(isProductEligibleForBusinessUnit([], BU_A)).toBe(true);
    expect(isProductEligibleForBusinessUnit([], BU_B)).toBe(true);
  });

  it("producto de una Business Unit específica solo es elegible para esa", () => {
    expect(isProductEligibleForBusinessUnit([BU_A], BU_A)).toBe(true);
    expect(isProductEligibleForBusinessUnit([BU_A], BU_B)).toBe(false);
  });
});

describe("filterEligibleCatalogProducts", () => {
  it("filtra TODAS + BU específica en una misma lista", () => {
    const products = [
      product({ id: "p-todas", businessUnitIds: [] }),
      product({ id: "p-a", businessUnitIds: [BU_A] }),
      product({ id: "p-b", businessUnitIds: [BU_B] }),
    ];
    const result = filterEligibleCatalogProducts(products, BU_A);
    expect(result.map((p) => p.id).sort()).toEqual(["p-a", "p-todas"]);
  });
});

describe("searchCatalogProducts", () => {
  const products = [
    product({ id: "p1", sku: "TP-0001", name: "Proyector LED Dual", model: "RT40076-2", brand: "Thunder LED Lights" }),
    product({ id: "p2", sku: "TP-SAFE-100", name: "Señalización de advertencia", model: "SAFE-100", brand: "Thunder Safety" }),
  ];

  it("busca por SKU", () => {
    expect(searchCatalogProducts(products, "tp-safe").map((p) => p.id)).toEqual(["p2"]);
  });

  it("busca por nombre", () => {
    expect(searchCatalogProducts(products, "advertencia").map((p) => p.id)).toEqual(["p2"]);
  });

  it("busca por modelo", () => {
    expect(searchCatalogProducts(products, "rt40076").map((p) => p.id)).toEqual(["p1"]);
  });

  it("busca por marca", () => {
    expect(searchCatalogProducts(products, "thunder safety").map((p) => p.id)).toEqual(["p2"]);
  });

  it("no hace matching fuzzy", () => {
    expect(searchCatalogProducts(products, "prroyector")).toHaveLength(0);
  });
});

describe("findIncompatibleItems", () => {
  it("línea de catálogo TODAS nunca es incompatible", () => {
    const p = product({ id: "p1", businessUnitIds: [] });
    const items = [{ catalogProductId: "p1" }];
    expect(findIncompatibleItems(items, catalogProductsById([p]), BU_B)).toHaveLength(0);
  });

  it("línea de catálogo NO elegible para la nueva BU se marca incompatible", () => {
    const p = product({ id: "p1", businessUnitIds: [BU_A] });
    const items = [{ catalogProductId: "p1" }];
    const result = findIncompatibleItems(items, catalogProductsById([p]), BU_B);
    expect(result).toHaveLength(1);
    expect(result[0]?.product.id).toBe("p1");
  });

  it("línea manual (catalogProductId null) nunca es incompatible", () => {
    const items = [{ catalogProductId: null }];
    expect(findIncompatibleItems(items, catalogProductsById([]), BU_B)).toHaveLength(0);
  });
});

describe("catalogProductsById", () => {
  it("indexa por id", () => {
    const p1 = product({ id: "p1" });
    const p2 = product({ id: "p2" });
    const map = catalogProductsById([p1, p2]);
    expect(map.get("p1")).toBe(p1);
    expect(map.size).toBe(2);
  });
});
