import { describe, expect, it } from "vitest";
import { resolveSupplierReferenceSnapshot, isMissingSupplierReference } from "./supplier-reference-display";

describe("resolveSupplierReferenceSnapshot (THÖREN — Supplier Product References)", () => {
  it("prefiere supplier_model_snapshot cuando existe", () => {
    expect(
      resolveSupplierReferenceSnapshot({ supplier_model_snapshot: "P7075R", supplier_sku_snapshot: "SKU-X" })
    ).toBe("P7075R");
  });

  it("cae a supplier_sku_snapshot cuando no hay modelo", () => {
    expect(resolveSupplierReferenceSnapshot({ supplier_model_snapshot: null, supplier_sku_snapshot: "SKU-X" })).toBe(
      "SKU-X"
    );
  });

  it("null si ninguno de los dos existe — nunca cae al modelo interno", () => {
    expect(resolveSupplierReferenceSnapshot({ supplier_model_snapshot: null, supplier_sku_snapshot: null })).toBeNull();
  });
});

describe("isMissingSupplierReference", () => {
  it("true para una partida catalogada sin ningun snapshot", () => {
    expect(
      isMissingSupplierReference({ catalog_product_id: "c1", supplier_model_snapshot: null, supplier_sku_snapshot: null })
    ).toBe(true);
  });

  it("false para una partida catalogada CON snapshot", () => {
    expect(
      isMissingSupplierReference({ catalog_product_id: "c1", supplier_model_snapshot: "P7075R", supplier_sku_snapshot: null })
    ).toBe(false);
  });

  it("false para una linea libre (catalog_product_id null) aunque no tenga snapshot — nunca aplica", () => {
    expect(
      isMissingSupplierReference({ catalog_product_id: null, supplier_model_snapshot: null, supplier_sku_snapshot: null })
    ).toBe(false);
  });
});
