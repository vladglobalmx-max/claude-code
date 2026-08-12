"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import {
  orderPayloadSchema,
  getMissingProjectorFields,
  getMissingProjectorFieldsFromRow,
  type OrderPayload,
} from "@/lib/validations/order";

export type OrderActionResult = { error: string; missingFields?: string[] } | void;

function buildOrderRow(payload: OrderPayload) {
  const p = payload.projector;
  return {
    salesperson_id: payload.salesperson_id,
    order_date: payload.order_date,
    client_name: payload.client_name,
    supplier_name: payload.supplier_name || null,
    product_type: payload.product_type,
    status: payload.status,
    general_notes: payload.general_notes || null,
    vendor_notes: payload.vendor_notes || null,
    vendor_notes_en: payload.vendor_notes_en || null,

    projector_model: p?.model || null,
    projector_quantity: p?.quantity ?? null,
    projector_power: p?.power || null,
    projector_lens_type: p?.lens_pending_factory ? "Por definir por fábrica" : p?.lens_type || null,
    projector_lens_pending_factory: p?.lens_pending_factory ?? false,

    projection_description: p?.description || null,
    projection_description_en: p?.description_en || null,
    projection_file_path: p?.file?.path || null,
    projection_file_name: p?.file?.name || null,
    projection_file_type: p?.file?.type || null,

    projection_width: p?.width ?? null,
    projection_height: p?.height ?? null,
    projection_size_unit: p?.size_unit || null,

    installation_height: p?.installation_height ?? null,
    installation_height_unit: p?.installation_height_unit || null,
    installation_distance: p?.installation_distance ?? null,
    installation_orientation: p?.orientation || null,
    installation_use: p?.use || null,

    surface_type: p?.surface_type || null,
    surface_material: p?.surface_material || null,
    surface_notes: p?.surface_notes || null,
    surface_notes_en: p?.surface_notes_en || null,
  };
}

function validatePayload(raw: OrderPayload): OrderActionResult {
  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const missing = getMissingProjectorFields(parsed.data);
  if (missing.length > 0) {
    return {
      error: "Falta información para enviar este pedido a fábrica",
      missingFields: missing,
    };
  }
}

/**
 * Crea el pedido completo (datos + productos + imágenes + archivos) en una
 * sola transacción vía rpc_create_order (ver migración 0004). Si cualquier
 * parte falla, Postgres revierte todo — incluido el incremento del
 * consecutivo del vendedor hecho por el trigger de folio, así que un pedido
 * que no llega a guardarse nunca "gasta" un folio.
 */
export async function createOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.rpc("rpc_create_order", {
    p_order_id: orderId,
    p_order: buildOrderRow(payload),
    p_items: payload.items,
    p_images: payload.images,
    p_files: payload.files,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo guardar el pedido. Intenta de nuevo.") };
  }

  revalidatePath("/pedidos");
  redirect(`/pedidos/${orderId}`);
}

/** Reemplaza campos + productos + imágenes + archivos en una sola transacción (rpc_update_order). */
export async function updateOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.rpc("rpc_update_order", {
    p_order_id: orderId,
    p_order: buildOrderRow(payload),
    p_items: payload.items,
    p_images: payload.images,
    p_files: payload.files,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  redirect(`/pedidos/${orderId}`);
}

/** Duplica un pedido completo (nuevo folio/fecha/consecutivo) en una sola transacción (rpc_duplicate_order). */
export async function duplicateOrder(sourceOrderId: string): Promise<{ id: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("rpc_duplicate_order", {
    p_source_order_id: sourceOrderId,
  });

  if (error || !data) {
    throw new Error(mapDbError(error, "No se pudo duplicar el pedido."));
  }

  revalidatePath("/pedidos");
  return { id: data.id };
}

export async function setOrderStatus(orderId: string, status: "borrador" | "pedido" | "cerrado" | "cancelado") {
  const supabase = createSupabaseServerClient();

  if (status === "pedido") {
    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (order && order.product_type === "proyector_gobo") {
      const missing = getMissingProjectorFieldsFromRow(order);
      if (missing.length > 0) {
        return { error: "Falta información para enviar este pedido a fábrica", missingFields: missing };
      }
    }
  }

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { error: mapDbError(error, "No se pudo actualizar el estado del pedido.") };

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
}
