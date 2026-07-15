import { describe, expect, it } from "vitest";

import {
  computeLandedCost,
  computeMarginPctFromSalePrice,
  computeSalePriceFromMargin,
  isBelowMinMargin,
} from "@/lib/catalog/margin";

describe("computeLandedCost", () => {
  it("sums purchase cost, logistics and import expenses", () => {
    const landed = computeLandedCost({
      purchaseCost: 55,
      logisticsCost: 4,
      importExpenses: 0,
    });
    expect(landed.toNumber()).toBe(59);
  });
});

describe("computeSalePriceFromMargin (docs/ARCHITECTURE.md §8.1 formula)", () => {
  it("matches the brief's worked example: cost 1000, margin 30% -> 1428.57", () => {
    const price = computeSalePriceFromMargin({ landedCost: 1000, marginPct: 30 });
    expect(price.toDecimalPlaces(2).toNumber()).toBe(1428.57);
  });

  it("never computes margin as markup (utility/cost, not utility/price)", () => {
    // markup of 30% on a 1000 cost would be 1300; the margin-based price must differ.
    const price = computeSalePriceFromMargin({ landedCost: 1000, marginPct: 30 });
    expect(price.toDecimalPlaces(2).toNumber()).not.toBe(1300);
  });

  it("throws for a margin of 100% or more (infinite price)", () => {
    expect(() => computeSalePriceFromMargin({ landedCost: 100, marginPct: 100 })).toThrow();
    expect(() => computeSalePriceFromMargin({ landedCost: 100, marginPct: 120 })).toThrow();
  });
});

describe("computeMarginPctFromSalePrice", () => {
  it("is the inverse of computeSalePriceFromMargin", () => {
    const price = computeSalePriceFromMargin({ landedCost: 59, marginPct: 25 });
    const marginPct = computeMarginPctFromSalePrice({ landedCost: 59, salePrice: price });
    expect(marginPct.toDecimalPlaces(2).toNumber()).toBe(25);
  });

  it("matches the GFB-ENJ-004 seed scenario: stale price falls below the minimum margin", () => {
    const marginPct = computeMarginPctFromSalePrice({ landedCost: 59, salePrice: 70 });
    expect(marginPct.toDecimalPlaces(2).toNumber()).toBeCloseTo(15.71, 2);
    expect(marginPct.toNumber()).toBeLessThan(25);
  });
});

describe("isBelowMinMargin", () => {
  it("flags a price below the minimum margin", () => {
    expect(isBelowMinMargin({ landedCost: 59, salePrice: 70, minMarginPct: 25 })).toBe(true);
  });

  it("does not flag a price at or above the minimum margin", () => {
    expect(isBelowMinMargin({ landedCost: 59, salePrice: 100, minMarginPct: 25 })).toBe(false);
  });
});
