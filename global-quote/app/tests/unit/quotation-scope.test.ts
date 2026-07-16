import { describe, expect, it } from "vitest";

import { quotationScopeWhere } from "@/lib/quotations/scope";

const BUSINESS_UNIT_IDS = ["bu-1", "bu-2"];
const USER_ID = "user-1";

describe("quotationScopeWhere (docs/ARCHITECTURE.md §4.1)", () => {
  it("SUPER_ADMIN, ADMINISTRACION, DIRECCION_GENERAL and GERENTE_VENTAS see all quotations in their assigned business units", () => {
    for (const role of [
      "SUPER_ADMIN",
      "ADMINISTRACION",
      "DIRECCION_GENERAL",
      "GERENTE_VENTAS",
    ] as const) {
      const where = quotationScopeWhere({ role, userId: USER_ID, businessUnitIds: BUSINESS_UNIT_IDS });
      expect(where).toEqual({ businessUnitId: { in: BUSINESS_UNIT_IDS }, deletedAt: null });
    }
  });

  it("VENDEDOR only sees quotations where they are the seller", () => {
    const where = quotationScopeWhere({
      role: "VENDEDOR",
      userId: USER_ID,
      businessUnitIds: BUSINESS_UNIT_IDS,
    });
    expect(where).toEqual({
      businessUnitId: { in: BUSINESS_UNIT_IDS },
      sellerId: USER_ID,
      deletedAt: null,
    });
  });

  it("MARKETING and CONSULTA have no quotation scope at all", () => {
    for (const role of ["MARKETING", "CONSULTA"] as const) {
      const where = quotationScopeWhere({ role, userId: USER_ID, businessUnitIds: BUSINESS_UNIT_IDS });
      expect(where).toBeNull();
    }
  });
});
