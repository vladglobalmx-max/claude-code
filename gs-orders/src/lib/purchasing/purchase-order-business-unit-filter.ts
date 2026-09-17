/**
 * THÖREN — Orden de Compra Directa (0081), fix de cierre: el listado de
 * Compras filtra por Business Unit contra DOS fuentes posibles de BU, ya
 * que una Purchase Order puede no tener Pedido de origen:
 *   - purchase_orders.business_unit_id (origin='directa', siempre poblado
 *     ahí; también puede venir poblado en una futura evolución de
 *     'requisicion', aunque hoy 'requisicion' no lo captura — se revisa
 *     de todas formas por si acaso, sin costo).
 *   - orders.business_unit_id, vía el Pedido de origen (origin='pedido',
 *     el único caso legado que siempre tuvo BU).
 * Una PO de 'requisicion' hoy no tiene ninguna de las dos poblada
 * (purchase_requisitions no captura Business Unit) — se deja fuera del
 * filtro por diseño, no por un bug: no hay BU real que comparar.
 */
export function purchaseOrderMatchesBusinessUnit(
  po: { business_unit_id: string | null; order: { business_unit_id: string | null } | null },
  businessUnitId: string
): boolean {
  return po.business_unit_id === businessUnitId || po.order?.business_unit_id === businessUnitId;
}
