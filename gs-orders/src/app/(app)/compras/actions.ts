"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import {
  purchaseOrderPayloadSchema,
  purchaseOrderDetailsPayloadSchema,
  purchaseOrderItemsReplacePayloadSchema,
  directPurchaseOrderPayloadSchema,
  type PurchaseOrderPayload,
  type PurchaseOrderDetailsPayload,
  type PurchaseOrderItemsReplacePayload,
  type DirectPurchaseOrderPayload,
} from "@/lib/validations/purchase-order";
import type { PurchaseOrderStatus } from "@/types/domain";

export type PurchaseOrderActionResult = { error: string } | void;

/**
 * THÖREN 6R.1B-3A (0045) — admin OR can_prepare_purchase_orders puede
 * crear una Purchase Order (siempre nace en 'borrador'). RLS ya lo
 * bloquea; la RPC además da un mensaje explícito en vez de un error de
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

/**
 * THÖREN — Orden de Compra Directa (0081). Sin Pedido/Sales Order/
 * Requisición/cliente — admin OR can_prepare_purchase_orders (RLS/RPC son
 * la autoridad real, esta Server Action no gatea nada por su cuenta).
 */
export async function createDirectPurchaseOrder(
  purchaseOrderId: string,
  payload: DirectPurchaseOrderPayload
): Promise<PurchaseOrderActionResult> {
  const parsed = directPurchaseOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_direct_purchase_order", {
    p_purchase_order_id: purchaseOrderId,
    p_purchase_order: {
      business_unit_id: parsed.data.business_unit_id,
      supplier_id: parsed.data.supplier_id,
      direct_purchase_reason: parsed.data.direct_purchase_reason,
      po_date: parsed.data.po_date ?? null,
      required_date: parsed.data.required_date ?? null,
      currency: parsed.data.currency,
      payment_terms: parsed.data.payment_terms ?? null,
      destination_warehouse_id: parsed.data.destination_warehouse_id ?? null,
      document_language: parsed.data.document_language ?? null,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items.map((item) => ({
      catalog_product_id: item.catalog_product_id ?? null,
      description: item.description ?? null,
      unit: item.unit ?? null,
      supplier_sku: item.supplier_sku ?? null,
      supplier_model: item.supplier_model ?? null,
      quantity_ordered: item.quantity_ordered,
      unit_price: item.unit_price,
      tax_percent: item.tax_percent,
    })),
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la Orden de Compra. Intenta de nuevo.") };
  }

  revalidatePath("/compras");
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

/**
 * THÖREN 6R.1B-3B — reemplaza el conjunto completo de partidas de una
 * Purchase Order EN BORRADOR (rpc_replace_purchase_order_items, 0045).
 * Autoridad real (admin OR can_prepare_purchase_orders, SIEMPRE borrador)
 * la decide el RPC/RLS — esta Server Action no gatea nada por su cuenta.
 */
export async function replacePurchaseOrderItems(
  purchaseOrderId: string,
  payload: PurchaseOrderItemsReplacePayload
): Promise<PurchaseOrderActionResult> {
  const parsed = purchaseOrderItemsReplacePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_replace_purchase_order_items", {
    p_purchase_order_id: purchaseOrderId,
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar las partidas de la Purchase Order.") };
  }

  revalidatePath(`/compras/${purchaseOrderId}`);
}

/**
 * THÖREN 0074 — fix puntual: refresca ÚNICAMENTE los snapshots de
 * proveedor (supplier_sku/model/description/uom) de las líneas
 * catalogadas de una Purchase Order EN BORRADOR, vía
 * rpc_refresh_purchase_order_supplier_references. A diferencia de
 * replacePurchaseOrderItems ("Reemplazar partidas"), esta acción NUNCA
 * toca cantidades/vínculos/estructura de las líneas y SÍ funciona para
 * una Purchase Order originada en Requisición (rpc_replace_purchase_order_items
 * la rechaza explícitamente, ver 0069 sección 19) — es la única vía real
 * para corregir un snapshot vacío en ese caso (bug OC-20261409-009).
 */
export async function refreshPurchaseOrderSupplierReferences(purchaseOrderId: string): Promise<PurchaseOrderActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_refresh_purchase_order_supplier_references", {
    p_purchase_order_id: purchaseOrderId,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron actualizar las referencias de proveedor. Intenta de nuevo.") };
  }

  revalidatePath(`/compras/${purchaseOrderId}`);
}

/**
 * THÖREN — Eliminación segura de Orden de Compra (0082). Admin OR
 * can_prepare_purchase_orders (misma autoridad que crear/preparar) — el
 * RPC (rpc_delete_purchase_order) es quien decide de verdad: solo status
 * borrador/cancelada, sin goods_receipts/quantity_received/inventory_
 * movements asociados. Esta Server Action no gatea nada por su cuenta,
 * solo traduce el error y redirige tras el éxito.
 */
export async function deletePurchaseOrder(purchaseOrderId: string): Promise<PurchaseOrderActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_delete_purchase_order", {
    p_purchase_order_id: purchaseOrderId,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo eliminar la Orden de Compra. Intenta de nuevo.") };
  }

  revalidatePath("/compras");
  redirect("/compras");
}
