import type { RoleCode } from "@/generated/prisma/enums";

/**
 * Alcance de `/admin/audit` por rol (docs/ARCHITECTURE.md §4.1: "Consultar
 * auditoría" — Super Admin y Dirección General sin restricción,
 * Administración "parcial"). `null` significa sin restricción; un arreglo
 * significa "solo estos tipos de entidad". Administración administra
 * clientes y catálogo, así que su vista parcial se limita a esas dos —
 * cualquier entidad de auditoría fuera de su dominio comercial (ej. cambios
 * de rol de usuario, si se auditaran en el futuro) queda reservada a
 * Dirección General/Super Admin.
 */
export function auditVisibleEntityTypes(role: RoleCode): string[] | null {
  if (role === "ADMINISTRACION") return ["Customer", "Product"];
  return null;
}
