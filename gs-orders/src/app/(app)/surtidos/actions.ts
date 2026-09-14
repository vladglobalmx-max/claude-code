"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { salesFulfillmentPayloadSchema } from "@/lib/validations/sales-fulfillment";
import { mapDbError } from "@/lib/db-errors";
import type { SalesFulfillment } from "@/types/domain";

export type SalesFulfillmentActionResult = { error: string } | void;
export type SalesFulfillmentResult = { error: string | null; fulfillment?: SalesFulfillment };

export interface SalesFulfillmentWriteItemPayload {
  sales_order_item_id: string;
  quantity_requested: number;
}

/**
 * Payload que arma el formulario de Surtido para
 * rpc_create_sales_fulfillment/rpc_update_sales_fulfillment (ver
 * 0071_sales_fulfillment_mvp.sql). sales_order_id solo lo usa
 * createSalesFulfillment — updateSalesFulfillment lo ignora porque es
 * inmutable una vez creado el surtido.
 */
export interface SalesFulfillmentWritePayload {
  sales_order_id: string;
  warehouse_id: string;
  delivery_contact?: string;
  delivery_notes?: string;
  items: SalesFulfillmentWriteItemPayload[];
}

/**
 * Crea el surtido completo (encabezado + líneas) en una sola transacción
 * vía rpc_create_sales_fulfillment. El fulfillment_number lo asigna
 * fn_next_sales_fulfillment_number() dentro del RPC. Nace SIEMPRE en
 * 'draft' — NO afecta inventario hasta que se despacha (dispatchSalesFulfillment).
 */
export async function createSalesFulfillment(payload: SalesFulfillmentWritePayload): Promise<SalesFulfillmentActionResult> {
  const parsed = salesFulfillmentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const fulfillmentId = randomUUID();

  const { error } = await supabase.rpc("rpc_create_sales_fulfillment", {
    p_fulfillment_id: fulfillmentId,
    p_fulfillment: {
      sales_order_id: parsed.data.sales_order_id,
      warehouse_id: parsed.data.warehouse_id,
      delivery_contact: parsed.data.delivery_contact ?? null,
      delivery_notes: parsed.data.delivery_notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear el surtido. Intenta de nuevo.") };
  }

  revalidatePath("/surtidos");
  revalidatePath(`/ordenes-venta/${parsed.data.sales_order_id}`);
  redirect(`/surtidos/${fulfillmentId}`);
}

/** Reemplaza almacén/contacto/notas + líneas de un surtido vía rpc_update_sales_fulfillment — el propio RPC aborta si el surtido ya no está en "draft". */
export async function updateSalesFulfillment(
  fulfillmentId: string,
  payload: SalesFulfillmentWritePayload
): Promise<SalesFulfillmentActionResult> {
  const parsed = salesFulfillmentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_sales_fulfillment", {
    p_fulfillment_id: fulfillmentId,
    p_fulfillment: {
      warehouse_id: parsed.data.warehouse_id,
      delivery_contact: parsed.data.delivery_contact ?? null,
      delivery_notes: parsed.data.delivery_notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/surtidos");
  revalidatePath(`/surtidos/${fulfillmentId}`);
  redirect(`/surtidos/${fulfillmentId}`);
}

/** draft -> cancelled vía rpc_cancel_sales_fulfillment — un surtido fuera de draft es inmutable y no puede cancelarse (decisión MVP). */
export async function cancelSalesFulfillment(fulfillmentId: string): Promise<SalesFulfillmentResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_cancel_sales_fulfillment", { p_fulfillment_id: fulfillmentId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo cancelar el surtido. Intenta de nuevo.") };
  }

  revalidatePath("/surtidos");
  revalidatePath(`/surtidos/${fulfillmentId}`);
  return { error: null, fulfillment: data as SalesFulfillment };
}

/** draft -> ready (picking/packing confirmado) vía rpc_mark_sales_fulfillment_ready. NO afecta inventario. */
export async function markSalesFulfillmentReady(fulfillmentId: string): Promise<SalesFulfillmentResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_mark_sales_fulfillment_ready", { p_fulfillment_id: fulfillmentId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo preparar el surtido. Intenta de nuevo.") };
  }

  revalidatePath("/surtidos");
  revalidatePath(`/surtidos/${fulfillmentId}`);
  return { error: null, fulfillment: data as SalesFulfillment };
}

/**
 * ready -> shipped vía rpc_dispatch_sales_fulfillment — atómico: crea
 * movimientos OUT, valida stock, actualiza cantidades surtidas y el
 * fulfillment_release_status de la Sales Order, todo en una transacción;
 * si falla, el surtido queda exactamente como estaba (garantizado por el
 * RPC, no por este action). Revalida /inventario también — el stock por
 * producto/almacén cambia al despachar.
 */
export async function dispatchSalesFulfillment(fulfillmentId: string): Promise<SalesFulfillmentResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_dispatch_sales_fulfillment", { p_fulfillment_id: fulfillmentId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo despachar el surtido. Intenta de nuevo.") };
  }

  const fulfillment = data as SalesFulfillment;
  revalidatePath("/surtidos");
  revalidatePath(`/surtidos/${fulfillmentId}`);
  revalidatePath(`/ordenes-venta/${fulfillment.sales_order_id}`);
  revalidatePath("/inventario");
  return { error: null, fulfillment };
}

/** shipped -> delivered vía rpc_mark_sales_fulfillment_delivered — registra delivered_at/delivered_by y notas/evidencia textual mínima. */
export async function markSalesFulfillmentDelivered(fulfillmentId: string, deliveryNotes?: string): Promise<SalesFulfillmentResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_mark_sales_fulfillment_delivered", {
    p_fulfillment_id: fulfillmentId,
    p_delivery_notes: deliveryNotes ?? null,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo marcar el surtido como entregado. Intenta de nuevo.") };
  }

  revalidatePath("/surtidos");
  revalidatePath(`/surtidos/${fulfillmentId}`);
  return { error: null, fulfillment: data as SalesFulfillment };
}

/** Único campo editable fuera de draft y aun con status 'delivered' (regla 12) — no aplica a 'cancelled'. */
export async function updateSalesFulfillmentDeliveryNotes(fulfillmentId: string, notes: string): Promise<SalesFulfillmentResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_update_sales_fulfillment_delivery_notes", {
    p_fulfillment_id: fulfillmentId,
    p_delivery_notes: notes,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudieron guardar las notas. Intenta de nuevo.") };
  }

  revalidatePath(`/surtidos/${fulfillmentId}`);
  return { error: null, fulfillment: data as SalesFulfillment };
}
