"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { goodsReceiptPayloadSchema } from "@/lib/validations/goods-receipt";
import { mapDbError } from "@/lib/db-errors";
import type { GoodsReceipt } from "@/types/domain";

export type GoodsReceiptActionResult = { error: string } | void;
export type GoodsReceiptResult = { error: string | null; goodsReceipt?: GoodsReceipt };

export interface GoodsReceiptWriteItemPayload {
  purchase_order_item_id: string;
  quantity_received: number;
}

/**
 * Payload que arma el formulario de Recepción de Mercancía para
 * rpc_create_goods_receipt/rpc_update_goods_receipt (ver
 * 0070_receiving_inventory_mvp.sql). purchase_order_id solo lo usa
 * createGoodsReceipt — updateGoodsReceipt lo ignora porque es inmutable
 * una vez creada la recepción (trg_prevent_goods_receipt_identity_change).
 */
export interface GoodsReceiptWritePayload {
  purchase_order_id: string;
  warehouse_id: string;
  received_at?: string;
  supplier_document_number?: string;
  notes?: string;
  items: GoodsReceiptWriteItemPayload[];
}

/**
 * Crea la recepción completa (encabezado + líneas) en una sola
 * transacción vía rpc_create_goods_receipt. El receipt_number lo asigna
 * fn_next_goods_receipt_number() dentro del RPC. Nace SIEMPRE en 'draft'
 * — NO afecta inventario hasta que se postea (postGoodsReceipt).
 */
export async function createGoodsReceipt(payload: GoodsReceiptWritePayload): Promise<GoodsReceiptActionResult> {
  const parsed = goodsReceiptPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const goodsReceiptId = randomUUID();

  const { error } = await supabase.rpc("rpc_create_goods_receipt", {
    p_goods_receipt_id: goodsReceiptId,
    p_goods_receipt: {
      purchase_order_id: parsed.data.purchase_order_id,
      warehouse_id: parsed.data.warehouse_id,
      received_at: parsed.data.received_at ?? null,
      supplier_document_number: parsed.data.supplier_document_number ?? null,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la recepción de mercancía. Intenta de nuevo.") };
  }

  revalidatePath("/recepciones");
  revalidatePath(`/compras/${parsed.data.purchase_order_id}`);
  redirect(`/recepciones/${goodsReceiptId}`);
}

/**
 * Reemplaza almacén/fecha/documento del proveedor/notas + líneas de una
 * recepción vía rpc_update_goods_receipt — el propio RPC aborta si la
 * recepción ya no está en "draft".
 */
export async function updateGoodsReceipt(
  goodsReceiptId: string,
  payload: GoodsReceiptWritePayload
): Promise<GoodsReceiptActionResult> {
  const parsed = goodsReceiptPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_goods_receipt", {
    p_goods_receipt_id: goodsReceiptId,
    p_goods_receipt: {
      warehouse_id: parsed.data.warehouse_id,
      received_at: parsed.data.received_at ?? null,
      supplier_document_number: parsed.data.supplier_document_number ?? null,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/recepciones");
  revalidatePath(`/recepciones/${goodsReceiptId}`);
  redirect(`/recepciones/${goodsReceiptId}`);
}

/** draft -> cancelled vía rpc_cancel_goods_receipt — una recepción posted es inmutable y no puede cancelarse (decisión MVP). */
export async function cancelGoodsReceipt(goodsReceiptId: string): Promise<GoodsReceiptResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_cancel_goods_receipt", { p_goods_receipt_id: goodsReceiptId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo cancelar la recepción de mercancía. Intenta de nuevo.") };
  }

  revalidatePath("/recepciones");
  revalidatePath(`/recepciones/${goodsReceiptId}`);
  return { error: null, goodsReceipt: data as GoodsReceipt };
}

/**
 * draft -> posted vía rpc_post_goods_receipt — atómico: crea inventory_movements,
 * actualiza quantity_received/status de la Purchase Order, todo en una
 * transacción; si falla, la recepción queda exactamente como estaba
 * (garantizado por el RPC, no por este action). Revalida /inventario
 * también — el stock por producto/almacén cambia al postear.
 */
export async function postGoodsReceipt(goodsReceiptId: string): Promise<GoodsReceiptResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_post_goods_receipt", { p_goods_receipt_id: goodsReceiptId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo postear la recepción de mercancía. Intenta de nuevo.") };
  }

  const goodsReceipt = data as GoodsReceipt;
  revalidatePath("/recepciones");
  revalidatePath(`/recepciones/${goodsReceiptId}`);
  revalidatePath(`/compras/${goodsReceipt.purchase_order_id}`);
  revalidatePath("/compras");
  revalidatePath("/inventario");
  return { error: null, goodsReceipt };
}
