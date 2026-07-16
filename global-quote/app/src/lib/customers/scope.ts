import "server-only";

import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Alcance de visibilidad de clientes por rol (docs/ARCHITECTURE.md §4/§11):
 * un Vendedor solo ve los clientes que tiene asignados; el resto de roles
 * con permiso ve todos los clientes de sus líneas de negocio asignadas.
 * Devuelve `null` si el rol no tiene ningún permiso de ver clientes.
 */
export function customerScopeWhere(input: {
  role: RoleCode;
  userId: string;
  businessUnitIds: string[];
}): Prisma.CustomerWhereInput | null {
  if (hasPermission(input.role, PERMISSIONS.VIEW_ALL_CUSTOMERS)) {
    return { businessUnitId: { in: input.businessUnitIds }, deletedAt: null };
  }
  if (hasPermission(input.role, PERMISSIONS.VIEW_OWN_CUSTOMERS)) {
    return {
      businessUnitId: { in: input.businessUnitIds },
      assignedSellerId: input.userId,
      deletedAt: null,
    };
  }
  return null;
}
