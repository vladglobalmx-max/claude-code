"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { groupRequirementsByOrder, describeMultiplePoCreation, type RequirementSelection } from "@/lib/purchasing/group-requirements-by-order";

export type CreatePurchaseOrdersFromRequirementsResult =
  | { error: string }
  | { purchaseOrderIds: string[]; message: string | null };

/**
 * THÖREN Fase 9 / Block 1 (0064) — Compras selecciona una o varias
 * necesidades de compra abiertas hacia UN proveedor y crea la(s) PO
 * correspondiente(s). Limitación estructural aprobada: `purchase_orders.
 * order_id` es de un solo Pedido (ver 0064) — si la selección abarca
 * Pedidos distintos, se crea UNA PO POR Pedido (rpc_create_purchase_order
 * ya rechazaría mezclar order_items de Pedidos distintos en una sola PO,
 * ver TEST 10 de 0064; esta acción simplemente agrupa ANTES de llamarlo,
 * en vez de dejar que el usuario lo descubra como un error).
 *
 * Cada PO se crea con `rpc_create_purchase_order` (sin cambios, 0035) y
 * luego cada partida resultante se enlaza a su necesidad de origen vía
 * `rpc_allocate_purchase_requirement` (0064) — el orden de
 * `purchase_order_items` creado es EXACTAMENTE el orden de `p_items`
 * enviado (rpc_create_purchase_order incrementa `position` secuencialmente
 * desde 0), así que se puede mapear de vuelta sin volver a consultar nada
 * más que esa lista ordenada.
 */
export async function createPurchaseOrdersFromRequirements(
  supplierId: string,
  selections: RequirementSelection[]
): Promise<CreatePurchaseOrdersFromRequirementsResult> {
  if (selections.length === 0) {
    return { error: "Selecciona al menos una necesidad de compra." };
  }
  if (selections.some((s) => !s.quantity || s.quantity <= 0)) {
    return { error: "La cantidad de cada necesidad debe ser mayor a cero." };
  }

  const supabase = createSupabaseServerClient();
  const groups = groupRequirementsByOrder(selections);
  const purchaseOrderIds: string[] = [];

  for (const group of groups) {
    const purchaseOrderId = crypto.randomUUID();
    const { error: createError } = await supabase.rpc("rpc_create_purchase_order", {
      p_purchase_order_id: purchaseOrderId,
      p_purchase_order: { order_id: group.orderId, supplier_id: supplierId, po_date: new Date().toISOString().slice(0, 10) },
      p_items: group.selections.map((s) => ({ order_item_id: s.orderItemId, quantity_ordered: s.quantity })),
    });
    if (createError) {
      return { error: mapDbError(createError, "No se pudo crear la Purchase Order. Intenta de nuevo.") };
    }

    const { data: createdItems, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select("id, position")
      .eq("purchase_order_id", purchaseOrderId)
      .order("position", { ascending: true });
    if (itemsError || !createdItems) {
      return { error: mapDbError(itemsError, "La Purchase Order se creó, pero no se pudieron leer sus partidas para enlazar las necesidades.") };
    }

    for (let i = 0; i < group.selections.length; i++) {
      const selection = group.selections[i];
      const purchaseOrderItemId = createdItems[i]?.id;
      if (!selection || !purchaseOrderItemId) continue;
      const { error: allocateError } = await supabase.rpc("rpc_allocate_purchase_requirement", {
        p_requirement_id: selection.requirementId,
        p_purchase_order_item_id: purchaseOrderItemId,
        p_allocated_qty: selection.quantity,
      });
      if (allocateError) {
        return {
          error: mapDbError(
            allocateError,
            `La Purchase Order ${purchaseOrderId} se creó, pero no se pudo enlazar una de sus necesidades de compra.`
          ),
        };
      }
    }

    purchaseOrderIds.push(purchaseOrderId);
  }

  revalidatePath("/compras");
  revalidatePath("/compras/necesidades");

  return { purchaseOrderIds, message: describeMultiplePoCreation(groups.length) };
}
