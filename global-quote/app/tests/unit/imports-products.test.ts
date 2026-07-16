import { describe, expect, it } from "vitest";

import { detectDuplicateSkus, parseProductImportRows } from "@/lib/imports/products";

function validRecord(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    businessUnitCode: "GFB",
    sku: "GFB-TEST-001",
    name: "Producto de prueba",
    uom: "PZA",
    categoryName: "",
    purchaseCost: "10",
    logisticsCost: "1",
    importExpenses: "0.5",
    targetMarginPct: "30",
    minMarginPct: "20",
    priceListCode: "GFB-LISTA-GENERAL",
    listPrice: "20",
    ...overrides,
  };
}

describe("parseProductImportRows (Módulo 14)", () => {
  it("accepts a fully valid row", () => {
    const [result] = parseProductImportRows([validRecord()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sku).toBe("GFB-TEST-001");
      expect(result.data.categoryName).toBeNull();
    }
  });

  it("numbers rows starting at 2 (the header is row 1)", () => {
    const results = parseProductImportRows([validRecord(), validRecord({ sku: "GFB-TEST-002" })]);
    expect(results.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it("rejects a SKU with invalid characters", () => {
    const [result] = parseProductImportRows([validRecord({ sku: "bad sku!" })]);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric cost field", () => {
    const [result] = parseProductImportRows([validRecord({ purchaseCost: "not-a-number" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("costo de compra"))).toBe(true);
  });

  it("rejects minMarginPct greater than targetMarginPct, same rule as the single-product form", () => {
    const [result] = parseProductImportRows([
      validRecord({ targetMarginPct: "10", minMarginPct: "20" }),
    ]);
    expect(result.ok).toBe(false);
  });

  it("treats a missing required column as empty and rejects it", () => {
    const [result] = parseProductImportRows([{ sku: "GFB-TEST-001" }]);
    expect(result.ok).toBe(false);
  });
});

describe("detectDuplicateSkus", () => {
  it("flags a SKU that already exists in the database", () => {
    const duplicates = detectDuplicateSkus(
      [{ rowNumber: 2, sku: "gfb-enj-001" }],
      new Set(["GFB-ENJ-001"]),
    );
    expect(duplicates).toEqual([{ rowNumber: 2, sku: "gfb-enj-001" }]);
  });

  it("flags the second occurrence of a SKU repeated within the same file, not the first", () => {
    const duplicates = detectDuplicateSkus(
      [
        { rowNumber: 2, sku: "GFB-NEW-001" },
        { rowNumber: 3, sku: "GFB-NEW-001" },
      ],
      new Set(),
    );
    expect(duplicates).toEqual([{ rowNumber: 3, sku: "GFB-NEW-001" }]);
  });

  it("does not flag a genuinely new SKU", () => {
    expect(detectDuplicateSkus([{ rowNumber: 2, sku: "GFB-NEW-001" }], new Set())).toEqual([]);
  });
});
