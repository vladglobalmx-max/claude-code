import { describe, expect, it } from "vitest";

import {
  AMOUNT_THRESHOLD_MXN,
  VALIDITY_MAX_DAYS,
  canApproveRule,
  computeApprovalTriggers,
} from "@/lib/quotations/approval-rules";

const NOW = new Date("2026-07-01T00:00:00.000Z");

const okItem = {
  unitPrice: 100,
  discountPct: 0,
  landedCostSnapshot: 50,
  minMarginPctSnapshot: 20,
};

describe("computeApprovalTriggers (docs/ARCHITECTURE.md §8.2/§12)", () => {
  it("returns no triggers for a plain quotation within all limits", () => {
    const triggers = computeApprovalTriggers({
      items: [okItem],
      discountLimitPct: 10,
      total: 100,
      validUntil: new Date("2026-07-10T00:00:00.000Z"),
      createdAt: NOW,
    });
    expect(triggers).toEqual([]);
  });

  it("triggers MARGIN_BELOW_MIN when an item's actual margin is below its minimum", () => {
    const triggers = computeApprovalTriggers({
      items: [{ unitPrice: 55, discountPct: 0, landedCostSnapshot: 50, minMarginPctSnapshot: 20 }],
      discountLimitPct: null,
      total: 55,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].ruleType).toBe("MARGIN_BELOW_MIN");
  });

  it("does not evaluate margin for items missing cost or minimum-margin snapshots", () => {
    const triggers = computeApprovalTriggers({
      items: [{ unitPrice: 1, discountPct: 0, landedCostSnapshot: null, minMarginPctSnapshot: null }],
      discountLimitPct: null,
      total: 1,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toEqual([]);
  });

  it("treats a zero-or-negative sale price (100% discount) as below minimum margin", () => {
    const triggers = computeApprovalTriggers({
      items: [{ unitPrice: 100, discountPct: 100, landedCostSnapshot: 50, minMarginPctSnapshot: 20 }],
      discountLimitPct: null,
      total: 0,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers.map((t) => t.ruleType)).toContain("MARGIN_BELOW_MIN");
  });

  it("triggers AMOUNT_OVER_THRESHOLD when total exceeds the MXN threshold", () => {
    const triggers = computeApprovalTriggers({
      items: [okItem],
      discountLimitPct: null,
      total: AMOUNT_THRESHOLD_MXN + 1,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].ruleType).toBe("AMOUNT_OVER_THRESHOLD");
  });

  it("does not trigger AMOUNT_OVER_THRESHOLD exactly at the threshold", () => {
    const triggers = computeApprovalTriggers({
      items: [okItem],
      discountLimitPct: null,
      total: AMOUNT_THRESHOLD_MXN,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toEqual([]);
  });

  it("triggers VALIDITY_OVER_30_DAYS when valid-until is more than 30 days after creation", () => {
    const validUntil = new Date(NOW.getTime() + (VALIDITY_MAX_DAYS + 1) * 24 * 60 * 60 * 1000);
    const triggers = computeApprovalTriggers({
      items: [okItem],
      discountLimitPct: null,
      total: 100,
      validUntil,
      createdAt: NOW,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].ruleType).toBe("VALIDITY_OVER_30_DAYS");
  });

  it("does not trigger VALIDITY_OVER_30_DAYS exactly at 30 days", () => {
    const validUntil = new Date(NOW.getTime() + VALIDITY_MAX_DAYS * 24 * 60 * 60 * 1000);
    const triggers = computeApprovalTriggers({
      items: [okItem],
      discountLimitPct: null,
      total: 100,
      validUntil,
      createdAt: NOW,
    });
    expect(triggers).toEqual([]);
  });

  it("triggers DISCOUNT_OVER_LIMIT when an item's discount exceeds the seller's limit", () => {
    const triggers = computeApprovalTriggers({
      items: [{ unitPrice: 100, discountPct: 15, landedCostSnapshot: 50, minMarginPctSnapshot: 5 }],
      discountLimitPct: 10,
      total: 85,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].ruleType).toBe("DISCOUNT_OVER_LIMIT");
  });

  it("does not trigger DISCOUNT_OVER_LIMIT when the seller has no discount limit configured", () => {
    const triggers = computeApprovalTriggers({
      items: [{ unitPrice: 100, discountPct: 90, landedCostSnapshot: 5, minMarginPctSnapshot: 5 }],
      discountLimitPct: null,
      total: 10,
      validUntil: null,
      createdAt: NOW,
    });
    expect(triggers).toEqual([]);
  });

  it("returns multiple triggers sorted by rule priority (margin, amount, validity, discount)", () => {
    const validUntil = new Date(NOW.getTime() + (VALIDITY_MAX_DAYS + 5) * 24 * 60 * 60 * 1000);
    const triggers = computeApprovalTriggers({
      items: [
        { unitPrice: 55, discountPct: 20, landedCostSnapshot: 50, minMarginPctSnapshot: 20 },
      ],
      discountLimitPct: 5,
      total: AMOUNT_THRESHOLD_MXN + 1,
      validUntil,
      createdAt: NOW,
    });
    expect(triggers.map((t) => t.ruleType)).toEqual([
      "MARGIN_BELOW_MIN",
      "AMOUNT_OVER_THRESHOLD",
      "VALIDITY_OVER_30_DAYS",
      "DISCOUNT_OVER_LIMIT",
    ]);
  });
});

describe("canApproveRule (docs/ARCHITECTURE.md §12)", () => {
  it("SUPER_ADMIN can approve every rule type", () => {
    for (const ruleType of [
      "MARGIN_BELOW_MIN",
      "AMOUNT_OVER_THRESHOLD",
      "VALIDITY_OVER_30_DAYS",
      "DISCOUNT_OVER_LIMIT",
    ] as const) {
      expect(canApproveRule("SUPER_ADMIN", ruleType)).toBe(true);
    }
  });

  it("only DIRECCION_GENERAL (besides SUPER_ADMIN) can approve MARGIN_BELOW_MIN and AMOUNT_OVER_THRESHOLD", () => {
    for (const ruleType of ["MARGIN_BELOW_MIN", "AMOUNT_OVER_THRESHOLD"] as const) {
      expect(canApproveRule("DIRECCION_GENERAL", ruleType)).toBe(true);
      expect(canApproveRule("GERENTE_VENTAS", ruleType)).toBe(false);
      expect(canApproveRule("ADMINISTRACION", ruleType)).toBe(false);
      expect(canApproveRule("VENDEDOR", ruleType)).toBe(false);
    }
  });

  it("GERENTE_VENTAS and DIRECCION_GENERAL can approve VALIDITY_OVER_30_DAYS and DISCOUNT_OVER_LIMIT", () => {
    for (const ruleType of ["VALIDITY_OVER_30_DAYS", "DISCOUNT_OVER_LIMIT"] as const) {
      expect(canApproveRule("GERENTE_VENTAS", ruleType)).toBe(true);
      expect(canApproveRule("DIRECCION_GENERAL", ruleType)).toBe(true);
      expect(canApproveRule("ADMINISTRACION", ruleType)).toBe(false);
      expect(canApproveRule("VENDEDOR", ruleType)).toBe(false);
    }
  });

  it("ADMINISTRACION has no approval authority over any rule despite having the general permission", () => {
    for (const ruleType of [
      "MARGIN_BELOW_MIN",
      "AMOUNT_OVER_THRESHOLD",
      "VALIDITY_OVER_30_DAYS",
      "DISCOUNT_OVER_LIMIT",
    ] as const) {
      expect(canApproveRule("ADMINISTRACION", ruleType)).toBe(false);
    }
  });
});
