/**
 * THÖREN Fase 9 / Block 1 — limitación estructural aprobada:
 * `purchase_orders.order_id` es de un solo Pedido (ver 0064). Cuando
 * Compras selecciona necesidades de Pedidos distintos hacia el mismo
 * proveedor, la capa de aplicación crea UNA PO POR Pedido — esta función
 * agrupa la selección para eso, y `describeMultiplePoCreation` arma el
 * mensaje que la UI debe mostrar sin ocultar la limitación (pedido
 * explícito del usuario).
 */
export type RequirementSelection = {
  requirementId: string;
  orderId: string;
  orderItemId: string;
  quantity: number;
};

export type RequirementOrderGroup = {
  orderId: string;
  selections: RequirementSelection[];
};

export function groupRequirementsByOrder(selections: RequirementSelection[]): RequirementOrderGroup[] {
  const orderIds: string[] = [];
  const byOrder = new Map<string, RequirementSelection[]>();
  for (const selection of selections) {
    if (!byOrder.has(selection.orderId)) {
      byOrder.set(selection.orderId, []);
      orderIds.push(selection.orderId);
    }
    byOrder.get(selection.orderId)!.push(selection);
  }
  return orderIds.map((orderId) => ({ orderId, selections: byOrder.get(orderId)! }));
}

/** null cuando todo cabe en una sola PO — no hay nada que advertir. */
export function describeMultiplePoCreation(orderCount: number): string | null {
  if (orderCount <= 1) return null;
  return `Se crearán ${orderCount} Purchase Orders porque actualmente cada PO pertenece a un solo Pedido.`;
}
