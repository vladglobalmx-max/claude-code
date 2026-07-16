import "server-only";

import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Alcance de visibilidad de pedidos: mismo criterio que
 * `quotations/scope.ts` (docs/ARCHITECTURE.md §4.1) — un pedido nace de una
 * cotización, así que quien podía ver esa cotización debe poder ver el
 * pedido resultante.
 */
export function orderScopeWhere(input: {
  role: RoleCode;
  userId: string;
  businessUnitIds: string[];
}): Prisma.OrderWhereInput | null {
  if (
    hasPermission(input.role, PERMISSIONS.VIEW_ALL_QUOTATIONS) ||
    hasPermission(input.role, PERMISSIONS.VIEW_TEAM_QUOTATIONS)
  ) {
    return { businessUnitId: { in: input.businessUnitIds } };
  }
  if (hasPermission(input.role, PERMISSIONS.VIEW_OWN_QUOTATIONS)) {
    return { businessUnitId: { in: input.businessUnitIds }, sellerId: input.userId };
  }
  return null;
}
