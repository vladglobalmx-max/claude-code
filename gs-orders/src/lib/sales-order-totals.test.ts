import { describe, expect, it } from "vitest";
import { computeSalesOrderTotals } from "./sales-order-totals";

describe("computeSalesOrderTotals — caso validado contra rpc_create_sales_order (THÖREN Sales Orders MVP 0067)", () => {
  /**
   * Mismo caso que TEST 6 de 0067_sales_orders_mvp_functional_tests.sql —
   * si este test falla tras un cambio en sales-order-totals.ts, la fórmula
   * divergió de 0067.
   *   Línea A: 2 × $100.00, descuento 10%, impuesto 16%
   *     gross $200.00 → descuento $20.00 → subtotal $180.00 → impuesto $28.80 → total $208.80
   *   Línea B: 1 × $50.00, sin descuento ni impuesto → subtotal $50.00, total $50.00
   *   Header: subtotal $230.00, tax_total $28.80, total $258.80
   */
  it("reproduce exactamente el caso validado contra SQL", () => {
    const result = computeSalesOrderTotals([
      { quantity: 2, unit_price: 100, discount: 10, tax: 16 },
      { quantity: 1, unit_price: 50, discount: 0, tax: 0 },
    ]);

    expect(result.lineSubtotals).toEqual([180, 50]);
    expect(result.lineTotals).toEqual([208.8, 50]);
    expect(result.subtotal).toBe(230);
    expect(result.taxTotal).toBe(28.8);
    expect(result.total).toBe(258.8);
  });

  it("una sola línea sin descuento ni impuesto: el total es igual al subtotal", () => {
    const result = computeSalesOrderTotals([{ quantity: 3, unit_price: 100, discount: 0, tax: 0 }]);

    expect(result.subtotal).toBe(300);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(300);
  });

  it("sin líneas: todos los totales son 0", () => {
    const result = computeSalesOrderTotals([]);

    expect(result.subtotal).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("redondea a 2 decimales igual que numeric(12,2) en Postgres", () => {
    const result = computeSalesOrderTotals([{ quantity: 3, unit_price: 33.333, discount: 0, tax: 0 }]);

    expect(result.subtotal).toBe(99.99);
  });
});
