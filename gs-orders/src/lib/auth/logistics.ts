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

/**
 * Registrar pagos, aprobar crédito, bloquear/liberar el estado financiero
 * de una Sales Order — mismo guard que las 4 RPCs financieras de 0068
 * (rpc_register_sales_order_payment/rpc_approve_sales_order_credit/
 * rpc_set_sales_order_financial_hold/rpc_release_sales_order): admin O la
 * capability, SIN rama de ownership — una persona de Finanzas típicamente
 * NO es el salesperson dueño de la Sales Order que está cobrando. Mismo
 * criterio que canReceiveInventory arriba.
 */
export function canManageSalesOrderFinance(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_manage_sales_order_finance");
}

/**
 * Crear/preparar/despachar/marcar como entregado un surtido (fulfillment)
 * de Sales Order — mismo guard que las RPCs de 0071
 * (rpc_create_sales_fulfillment/rpc_mark_sales_fulfillment_ready/
 * rpc_dispatch_sales_fulfillment/rpc_mark_sales_fulfillment_delivered/
 * rpc_cancel_sales_fulfillment/rpc_update_sales_fulfillment_delivery_notes):
 * admin O la capability, SIN rama de ownership — mismo criterio que
 * canManageSalesOrderFinance/canReceiveInventory (logística típicamente NO
 * es el salesperson dueño de la Sales Order). Deliberadamente NO reutiliza
 * can_fulfill_inventory (0040/0044): esa capability es explícitamente de
 * Pedidos ("surtir reservas de inventario para pedidos"), no de Sales
 * Orders — ver DECISIÓN en 0071_sales_fulfillment_mvp.sql.
 */
export function canManageSalesFulfillment(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_manage_sales_fulfillment");
}

/**
 * Ver/crear/liberar/pagar/cancelar comisiones de venta — mismo guard que
 * las RPCs de 0073 (rpc_create_commission_record/
 * rpc_refresh_commission_eligibility/rpc_register_commission_payment/
 * rpc_cancel_commission_record). A diferencia de TODAS las demás
 * capabilities de este archivo, esto es DELIBERADO en DOS sentidos más
 * estrictos: (1) ni siquiera el vendedor dueño de la Sales Order tiene
 * autoridad aquí, y (2) ni siquiera `role === "admin"` la otorga
 * automáticamente — la autoridad es EXCLUSIVAMENTE la capability
 * can_manage_commissions (ajuste explícito post-review: Dirección General
 * la recibe como capability; otros admins NO la tienen por defecto). Esto
 * espeja current_user_has_commission_authority() (0073), el helper de DB
 * dedicado que tampoco usa el atajo de admin de current_user_has_capability().
 */
export function canManageCommissions(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  return capabilities.has("can_manage_commissions");
}
