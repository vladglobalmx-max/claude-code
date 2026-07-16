import { describe, expect, it } from "vitest";

import { diffSensitiveFields } from "@/lib/audit/log";
import { auditVisibleEntityTypes } from "@/lib/audit/scope";

describe("diffSensitiveFields (docs/ARCHITECTURE.md §5.2/§10)", () => {
  it("reports only the configured fields that actually changed", () => {
    const before = { creditLimit: 1000, authorizedDiscountPct: 5, assignedSellerId: "seller-1", notes: "a" };
    const after = { creditLimit: 2000, authorizedDiscountPct: 5, assignedSellerId: "seller-2", notes: "b" };

    const changes = diffSensitiveFields(before, after, [
      "creditLimit",
      "authorizedDiscountPct",
      "assignedSellerId",
    ]);

    expect(changes).toEqual([
      { field: "creditLimit", oldValue: "1000", newValue: "2000" },
      { field: "assignedSellerId", oldValue: "seller-1", newValue: "seller-2" },
    ]);
  });

  it("returns an empty array when none of the sensitive fields changed", () => {
    const before = { creditLimit: 1000, notes: "a" };
    const after = { creditLimit: 1000, notes: "changed but not sensitive" };

    expect(diffSensitiveFields(before, after, ["creditLimit"])).toEqual([]);
  });

  it("treats null and undefined as equivalent to a missing value, and reports transitions to/from null", () => {
    const before = { assignedSellerId: null as string | null };
    const after = { assignedSellerId: "seller-1" };

    expect(diffSensitiveFields(before, after, ["assignedSellerId"])).toEqual([
      { field: "assignedSellerId", oldValue: null, newValue: "seller-1" },
    ]);

    expect(
      diffSensitiveFields({ assignedSellerId: "seller-1" }, { assignedSellerId: null }, [
        "assignedSellerId",
      ]),
    ).toEqual([{ field: "assignedSellerId", oldValue: "seller-1", newValue: null }]);
  });

  it("stringifies Decimal-like values consistently so equal amounts don't false-positive", () => {
    const decimalLike = (value: string) => ({ toString: () => value });
    const before = { landedCost: decimalLike("12.50") };
    const after = { landedCost: decimalLike("12.50") };

    expect(diffSensitiveFields(before, after, ["landedCost"])).toEqual([]);
  });
});

describe("auditVisibleEntityTypes (docs/ARCHITECTURE.md §4.1)", () => {
  it("SUPER_ADMIN and DIRECCION_GENERAL have no entity-type restriction", () => {
    expect(auditVisibleEntityTypes("SUPER_ADMIN")).toBeNull();
    expect(auditVisibleEntityTypes("DIRECCION_GENERAL")).toBeNull();
  });

  it("ADMINISTRACION is restricted to its own commercial domain (Customer, Product)", () => {
    expect(auditVisibleEntityTypes("ADMINISTRACION")).toEqual(["Customer", "Product"]);
  });
});
