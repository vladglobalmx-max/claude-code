import { describe, expect, it } from "vitest";

import { computeTaxTotal } from "@/lib/quotations/tax";

describe("computeTaxTotal (docs/ARCHITECTURE.md §5.2)", () => {
  it("returns 0 when no tax was chosen (null rate)", () => {
    expect(computeTaxTotal(1000, null).toString()).toBe("0");
  });

  it("computes 16% IVA over the pre-tax total", () => {
    expect(computeTaxTotal(1000, 16).toString()).toBe("160");
  });

  it("returns 0 for a 0% rate (e.g. 'Tasa 0%' catalog entry)", () => {
    expect(computeTaxTotal(1000, 0).toString()).toBe("0");
  });

  it("keeps full Decimal precision, not floating-point rounding", () => {
    expect(computeTaxTotal(123.45, 16).toString()).toBe("19.752");
  });
});
