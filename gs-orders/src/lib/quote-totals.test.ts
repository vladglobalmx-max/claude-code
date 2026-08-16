import { describe, expect, it } from "vitest";
import { computeQuoteTotals } from "./quote-totals";

describe("computeQuoteTotals — caso validado contra rpc_create_quote (THÖREN Quotes Q3)", () => {
  /**
   * Caso de regresión permanente (ver aprobación de Q4): Subtotal $2,150.00
   * → Descuento $265.00 → Base $1,935.00 → IVA 16% $309.60 → TOTAL
   * $2,244.60. Reconstruido con entradas concretas y exactas:
   *   - Línea 1: 1 × $2,000.00, sin descuento de línea → subtotal $2,000.00
   *   - Línea 2: 1 × $200.00, 25% descuento de línea → descuento $50.00,
   *     subtotal $150.00
   *   - Subtotal de la Quote: $2,000.00 + $150.00 = $2,150.00
   *   - Descuento global 10% sobre $2,150.00 = $215.00
   *   - Descuento total: $50.00 (línea) + $215.00 (global) = $265.00
   *   - Base gravable: $2,150.00 − $215.00 = $1,935.00
   *   - IVA 16% sobre $1,935.00 = $309.60
   *   - Total: $1,935.00 + $309.60 = $2,244.60
   * Este resultado debe coincidir siempre con lo que devuelve
   * rpc_create_quote/rpc_update_quote para la misma entrada — si este test
   * falla tras un cambio en quote-totals.ts, la fórmula divergió de 0020.
   */
  it("reproduce exactamente el caso validado", () => {
    const result = computeQuoteTotals({
      items: [
        { quantity: 1, unit_price: 2000, line_discount_percent: 0 },
        { quantity: 1, unit_price: 200, line_discount_percent: 25 },
      ],
      global_discount_percent: 10,
      tax_rate: 16,
    });

    expect(result.lineSubtotals).toEqual([2000, 150]);
    expect(result.subtotal).toBe(2150);
    expect(result.discountTotal).toBe(265);
    expect(result.taxTotal).toBe(309.6);
    expect(result.total).toBe(2244.6);
  });

  it("una sola línea sin descuentos: el total es subtotal + IVA", () => {
    const result = computeQuoteTotals({
      items: [{ quantity: 3, unit_price: 100, line_discount_percent: 0 }],
      global_discount_percent: 0,
      tax_rate: 16,
    });

    expect(result.subtotal).toBe(300);
    expect(result.discountTotal).toBe(0);
    expect(result.taxTotal).toBe(48);
    expect(result.total).toBe(348);
  });

  it("sin productos: todos los totales son 0", () => {
    const result = computeQuoteTotals({ items: [], global_discount_percent: 0, tax_rate: 16 });

    expect(result.subtotal).toBe(0);
    expect(result.discountTotal).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("redondea a 2 decimales igual que numeric(12,2) en Postgres", () => {
    const result = computeQuoteTotals({
      items: [{ quantity: 3, unit_price: 33.333, line_discount_percent: 0 }],
      global_discount_percent: 0,
      tax_rate: 16,
    });

    // unit_price se redondea a 33.33 antes de multiplicar (mismo efecto que
    // el typmod numeric(12,2) en la variable v_unit_price de 0020).
    expect(result.subtotal).toBe(99.99);
  });
});
