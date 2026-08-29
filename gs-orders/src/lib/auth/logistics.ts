import type { CurrentProfile } from "./profile";
import { canWriteRecord } from "./ownership";

/**
 * Autoridad LOGÍSTICA cross-sales (THÖREN 6R.1B-2) — separada por diseño
 * de canWriteRecord (autoridad comercial por ownership/admin, ver
 * ownership.ts), que se mantiene intacto y NUNCA se modifica aquí. Cada
 * helper espeja EXACTAMENTE el guard backend correspondiente wireado en
 * 0044_logistics_cross_sales_capabilities.sql:
 *   admin OR dueño (cuando el dueño YA tenía esa autoridad antes de 0044)
 *   OR la capability específica.
 * can_view_all_sales NUNCA aparece aquí — amplía lectura (0041), nunca
 * autoridad de escritura logística ni comercial.
 */

type CapabilityProfile = Pick<CurrentProfile, "role" | "salespersonId" | "active">;

/** Reservar/ajustar/liberar reserva de inventario — mismo guard que rpc_reserve_inventory / rpc_adjust_inventory_reservation / rpc_release_inventory_reservation. */
export function canReserveInventory(
  profile: CapabilityProfile | null,
  capabilities: ReadonlySet<string>,
  orderSalespersonId: string | null
): boolean {
  if (!profile || !profile.active) return false;
  return canWriteRecord(profile, orderSalespersonId) || capabilities.has("can_reserve_inventory");
}

/** Surtir una reserva — mismo guard que rpc_fulfill_inventory_reservation. Independiente de can_reserve_inventory (0044: las capabilities son independientes entre sí). */
export function canFulfillInventory(
  profile: CapabilityProfile | null,
  capabilities: ReadonlySet<string>,
  orderSalespersonId: string | null
): boolean {
  if (!profile || !profile.active) return false;
  return canWriteRecord(profile, orderSalespersonId) || capabilities.has("can_fulfill_inventory");
}

/** Crear/editar/cambiar estado de una Entrega y su evidencia — mismo guard que rpc_create_delivery / rpc_update_delivery_status / rpc_update_delivery_details / delivery_files. */
export function canManageDeliveries(
  profile: CapabilityProfile | null,
  capabilities: ReadonlySet<string>,
  orderSalespersonId: string | null
): boolean {
  if (!profile || !profile.active) return false;
  return canWriteRecord(profile, orderSalespersonId) || capabilities.has("can_manage_deliveries");
}

/**
 * Registrar recepción física de mercancía contra una Purchase Order —
 * mismo guard que rpc_receive_purchase_order_item: admin O la capability,
 * SIN rama de ownership. A diferencia de reservas/fulfillment/entregas,
 * el dueño comercial del Pedido NUNCA tuvo autoridad para recibir
 * mercancía de una OC (0035/0036: siempre fue admin-only) — no hay
 * "autoridad previa" del vendedor que preservar aquí, por eso este
 * helper deliberadamente no recibe ni usa ningún salesperson_id ni llama
 * a canWriteRecord.
 */
export function canReceiveInventory(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_receive_inventory");
}
