"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import {
  purchaseOrderPayloadSchema,
  purchaseOrderDetailsPayloadSchema,
  type PurchaseOrderPayload,
  type PurchaseOrderDetailsPayload,
} from "@/lib/validations/purchase-order";
import type { PurchaseOrderStatus } from "@/types/domain";

export type PurchaseOrderActionResult = { error: string } | void;

/**
 * THÖREN Fase 6L — solo ADMIN gestiona Compras (ver DECISIÓN de permisos,
 * 0035_purchases_suppliers.sql); RLS ya lo bloquea, pero la RPC además da
 * un mensaje explícito ("Solo un administrador...") en vez de un error de
 * RLS genérico.
 */
export async function createPurchaseOrder(
  purchaseOrderId: string,
  payload: PurchaseOrderPayload
): Promise<PurchaseOrderActionResult> {
  const parsed = purchaseOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_purchase_order", {
    p_purchase_order_id: purchaseOrderId,
    p_purchase_order: {
      order_id: parsed.data.order_id,
      supplier_id: parsed.data.supplier_id,
      po_date: parsed.data.po_date,
      supplier_commitment_date: parsed.data.supplier_commitment_date ?? null,
      estimated_reception_date: parsed.data.estimated_reception_date ?? null,
      supplier_reference: parsed.data.supplier_reference ?? null,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la Purchase Order. Intenta de nuevo.") };
  }

  revalidatePath("/compras");
  revalidatePath(`/pedidos/${parsed.data.order_id}`);
  redirect(`/compras/${purchaseOrderId}`);
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus
): Promise<PurchaseOrderActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_purchase_order_status", {
    p_purchase_order_id: purchaseOrderId,
    p_status: status,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el estado de la Purchase Order.") };
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/${purchaseOrderId}`);
}

export async function updatePurchaseOrderDetails(
  purchaseOrderId: string,
  payload: PurchaseOrderDetailsPayload
): Promise<PurchaseOrderActionResult> {
  const parsed = purchaseOrderDetailsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_purchase_order_details", {
    p_purchase_order_id: purchaseOrderId,
    p_purchase_order: {
      supplier_commitment_date: parsed.data.supplier_commitment_date ?? null,
      estimated_reception_date: parsed.data.estimated_reception_date ?? null,
      supplier_reference: parsed.data.supplier_reference ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios de la Purchase Order.") };
  }

  revalidatePath(`/compras/${purchaseOrderId}`);
}

/** quantityReceived es el valor ACUMULADO (no un delta) — ver rpc_receive_purchase_order_item. */
export async function receivePurchaseOrderItem(
  purchaseOrderItemId: string,
  purchaseOrderId: string,
  quantityReceived: number
): Promise<PurchaseOrderActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_receive_purchase_order_item", {
    p_purchase_order_item_id: purchaseOrderItemId,
    p_quantity_received: quantityReceived,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo registrar la recepción.") };
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/${purchaseOrderId}`);
}
