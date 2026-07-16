import "server-only";

import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Alcance de visibilidad de cotizaciones por rol (docs/ARCHITECTURE.md
 * §4.1): un Vendedor solo ve las suyas; Gerente de Ventas y el resto de
 * roles con permiso ven todas las de sus líneas de negocio asignadas (no
 * existe todavía el concepto de "equipo", así que VIEW_TEAM_QUOTATIONS se
 * trata como alcance por línea, igual que VIEW_ALL_QUOTATIONS — ver nota en
 * docs/ARCHITECTURE.md §10 sobre reasignación de cartera). Devuelve `null`
 * si el rol no tiene ningún permiso de ver cotizaciones.
 */
export function quotationScopeWhere(input: {
  role: RoleCode;
  userId: string;
  businessUnitIds: string[];
}): Prisma.QuotationWhereInput | null {
  if (
    hasPermission(input.role, PERMISSIONS.VIEW_ALL_QUOTATIONS) ||
    hasPermission(input.role, PERMISSIONS.VIEW_TEAM_QUOTATIONS)
  ) {
    return { businessUnitId: { in: input.businessUnitIds }, deletedAt: null };
  }
  if (hasPermission(input.role, PERMISSIONS.VIEW_OWN_QUOTATIONS)) {
    return {
      businessUnitId: { in: input.businessUnitIds },
      sellerId: input.userId,
      deletedAt: null,
    };
  }
  return null;
}
