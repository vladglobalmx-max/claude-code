import { describe, expect, it, vi } from "vitest";

// "server-only" siempre lanza fuera del bundler de Next — mismo mock que
// adapters.test.ts, para poder importar purchase-order.ts directo en
// Vitest (Node plano).
vi.mock("server-only", () => ({}));

const { buildDirectPurchaseOrderRow } = await import("./purchase-order");

/**
 * THÖREN — fix de cierre 0081: la rama `isDirect` del PDF de Purchase
 * Order no mostraba ningún SKU/referencia por partida. Cubre la prioridad
 * de la columna "reference" (supplier_sku_snapshot -> supplier_model_
 * snapshot -> "—", nunca el SKU interno como sustituto) y la línea
 * secundaria "Internal SKU" dentro de "description".
 */
describe("buildDirectPurchaseOrderRow", () => {
  const base = {
    description: "Overhead Crane Safety Light RED",
    model: "TLLXXXX",
    unit: "Pcs",
    quantity_ordered: 24,
    unit_price: 149,
    line_total: 3576,
    supplier_sku_snapshot: null as string | null,
    supplier_model_snapshot: null as string | null,
  };

  it("usa supplier_sku_snapshot como referencia cuando está presente", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, supplier_sku_snapshot: "XRL-12345", supplier_model_snapshot: "ALGO-OTRO" });
    expect(row.reference).toBe("XRL-12345");
  });

  it("cae a supplier_model_snapshot cuando no hay supplier_sku_snapshot", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, supplier_sku_snapshot: null, supplier_model_snapshot: "ALGO-OTRO" });
    expect(row.reference).toBe("ALGO-OTRO");
  });

  it('usa "—" cuando no hay ninguna referencia del proveedor', () => {
    const row = buildDirectPurchaseOrderRow({ ...base, supplier_sku_snapshot: null, supplier_model_snapshot: null });
    expect(row.reference).toBe("—");
  });

  it("nunca cae al SKU interno (model) como sustituto de la referencia del proveedor", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, model: "TLLXXXX", supplier_sku_snapshot: null, supplier_model_snapshot: null });
    expect(row.reference).not.toBe("TLLXXXX");
    expect(row.reference).toBe("—");
  });

  it("agrega el SKU interno como línea secundaria en description cuando hay descripción libre y model", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, description: "Overhead Crane Safety Light RED", model: "TLLXXXX" });
    expect(row.description).toBe("Overhead Crane Safety Light RED\nInternal SKU: TLLXXXX");
  });

  it("no duplica la línea Internal SKU cuando no hay descripción libre (description cae a model)", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, description: null, model: "TLLXXXX" });
    expect(row.description).toBe("TLLXXXX");
  });

  it("no muestra la línea Internal SKU cuando model está vacío", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, description: "Overhead Crane Safety Light RED", model: "" });
    expect(row.description).toBe("Overhead Crane Safety Light RED");
  });

  it("formatea unitPrice/amount igual que antes del cambio", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, unit_price: 149, line_total: 3576 });
    expect(row.unitPrice).toBe("$149.00");
    expect(row.amount).toBe("$3576.00");
  });

  it('usa "—" para unitPrice/amount cuando son null', () => {
    const row = buildDirectPurchaseOrderRow({ ...base, unit_price: null, line_total: null });
    expect(row.unitPrice).toBe("—");
    expect(row.amount).toBe("—");
  });

  it("conserva unit y quantity sin cambios", () => {
    const row = buildDirectPurchaseOrderRow({ ...base, unit: "Pcs", quantity_ordered: 24 });
    expect(row.unit).toBe("Pcs");
    expect(row.quantity).toBe("24");
  });
});
