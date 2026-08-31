import type { CurrentProfile } from "./profile";

/**
 * Autoridad de Purchase Orders — Preparar vs Aprobar (THÖREN 6R.1B-3).
 * Espeja EXACTAMENTE el guard backend de 0045:
 *   admin OR la capability específica.
 * Deliberadamente SIN rama de ownership (a diferencia de canWriteRecord/
 * logistics.ts): 0045 confirmó por diseño que can_prepare_purchase_orders
 * NO depende de quién creó la Purchase Order — cualquier preparador activo
 * de la misma organización puede trabajar cualquier OC en borrador que le
 * sea visible. can_receive_inventory (0044) vive aparte en logistics.ts —
 * no se mezcla conceptualmente aquí. Ninguna de las dos implica la otra.
 */

type CapabilityProfile = Pick<CurrentProfile, "role" | "active">;

/** Crear/editar detalles/reemplazar partidas/cancelar mientras está en borrador — mismo guard que rpc_create_purchase_order / rpc_update_purchase_order_details / rpc_replace_purchase_order_items. */
export function canPreparePurchaseOrders(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_prepare_purchase_orders");
}

/** Sacar de borrador y administrar el ciclo posterior (incluida cancelar post-borrador) — mismo guard que rpc_update_purchase_order_status para transiciones fuera de "borrador -> cancelada". */
export function canApprovePurchaseOrders(profile: CapabilityProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_approve_purchase_orders");
}
