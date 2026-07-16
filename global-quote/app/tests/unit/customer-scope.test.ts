import { describe, expect, it } from "vitest";

import { customerScopeWhere } from "@/lib/customers/scope";

const BUSINESS_UNIT_IDS = ["bu-1", "bu-2"];
const USER_ID = "user-1";

describe("customerScopeWhere (docs/ARCHITECTURE.md §4/§11)", () => {
  it("SUPER_ADMIN and ADMINISTRACION see all customers in their assigned business units", () => {
    for (const role of ["SUPER_ADMIN", "ADMINISTRACION", "DIRECCION_GENERAL", "GERENTE_VENTAS"] as const) {
      const where = customerScopeWhere({ role, userId: USER_ID, businessUnitIds: BUSINESS_UNIT_IDS });
      expect(where).toEqual({ businessUnitId: { in: BUSINESS_UNIT_IDS }, deletedAt: null });
    }
  });

  it("VENDEDOR only sees customers assigned to them", () => {
    const where = customerScopeWhere({
      role: "VENDEDOR",
      userId: USER_ID,
      businessUnitIds: BUSINESS_UNIT_IDS,
    });
    expect(where).toEqual({
      businessUnitId: { in: BUSINESS_UNIT_IDS },
      assignedSellerId: USER_ID,
      deletedAt: null,
    });
  });

  it("MARKETING and CONSULTA have no customer scope at all", () => {
    for (const role of ["MARKETING", "CONSULTA"] as const) {
      const where = customerScopeWhere({ role, userId: USER_ID, businessUnitIds: BUSINESS_UNIT_IDS });
      expect(where).toBeNull();
    }
  });
});
