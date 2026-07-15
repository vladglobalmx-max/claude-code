import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  findRequiredPermissionForPath,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";

const ALL_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "DIRECCION_GENERAL",
  "ADMINISTRACION",
  "GERENTE_VENTAS",
  "VENDEDOR",
  "MARKETING",
  "CONSULTA",
];

describe("permissions matrix (docs/ARCHITECTURE.md §4.1)", () => {
  it("every role code declared in RoleCode has an entry in ROLE_PERMISSIONS", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("SUPER_ADMIN has every permission in the catalog", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission("SUPER_ADMIN", permission)).toBe(true);
    }
  });

  it("VENDEDOR cannot view costs, margin amounts, or manage price lists", () => {
    expect(hasPermission("VENDEDOR", PERMISSIONS.VIEW_COSTS)).toBe(false);
    expect(hasPermission("VENDEDOR", PERMISSIONS.VIEW_MARGIN_AMOUNT)).toBe(false);
    expect(hasPermission("VENDEDOR", PERMISSIONS.MANAGE_PRICE_LISTS)).toBe(false);
    expect(hasPermission("VENDEDOR", PERMISSIONS.EDIT_APPROVED_QUOTATION)).toBe(false);
    expect(hasPermission("VENDEDOR", PERMISSIONS.DELETE_QUOTATION)).toBe(false);
  });

  it("VENDEDOR can create quotations, apply discounts and generate PDFs", () => {
    expect(hasPermission("VENDEDOR", PERMISSIONS.CREATE_QUOTATION)).toBe(true);
    expect(hasPermission("VENDEDOR", PERMISSIONS.APPLY_DISCOUNT)).toBe(true);
    expect(hasPermission("VENDEDOR", PERMISSIONS.GENERATE_PDF)).toBe(true);
  });

  it("GERENTE_VENTAS can see margin percentage but not cost or margin amount", () => {
    expect(hasPermission("GERENTE_VENTAS", PERMISSIONS.VIEW_MARGIN_PCT)).toBe(true);
    expect(hasPermission("GERENTE_VENTAS", PERMISSIONS.VIEW_COSTS)).toBe(false);
    expect(hasPermission("GERENTE_VENTAS", PERMISSIONS.VIEW_MARGIN_AMOUNT)).toBe(false);
  });

  it("MARKETING cannot view costs/margins nor approve exceptions", () => {
    expect(hasAnyPermission("MARKETING", [PERMISSIONS.VIEW_COSTS, PERMISSIONS.VIEW_MARGIN_AMOUNT])).toBe(
      false,
    );
    expect(hasPermission("MARKETING", PERMISSIONS.APPROVE_EXCEPTION)).toBe(false);
    expect(hasPermission("MARKETING", PERMISSIONS.MANAGE_PRODUCT_MARKETING_INFO)).toBe(true);
  });

  it("CONSULTA has no mutating permissions", () => {
    expect(ROLE_PERMISSIONS.CONSULTA).toEqual([]);
  });

  it("only Super Admin can configure sequences (folios) and roles", () => {
    for (const role of ALL_ROLES) {
      const canConfigureSequences = hasPermission(role, PERMISSIONS.CONFIGURE_SEQUENCES);
      const canConfigureRoles = hasPermission(role, PERMISSIONS.CONFIGURE_ROLES);
      if (role === "SUPER_ADMIN") {
        expect(canConfigureSequences).toBe(true);
        expect(canConfigureRoles).toBe(true);
      } else {
        expect(canConfigureSequences).toBe(false);
        expect(canConfigureRoles).toBe(false);
      }
    }
  });
});

describe("findRequiredPermissionForPath", () => {
  it("resolves the exact admin route", () => {
    expect(findRequiredPermissionForPath("/admin/users")).toBe(PERMISSIONS.MANAGE_USERS);
  });

  it("resolves nested admin routes", () => {
    expect(findRequiredPermissionForPath("/admin/sequences/tss")).toBe(
      PERMISSIONS.CONFIGURE_SEQUENCES,
    );
  });

  it("returns undefined for routes with no configured gate", () => {
    expect(findRequiredPermissionForPath("/dashboard")).toBeUndefined();
  });
});
