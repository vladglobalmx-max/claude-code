"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessToday } from "@/lib/business-date";
import { mapDbError } from "@/lib/db-errors";
import {
  orderPayloadSchema,
  getMissingProjectorFields,
  getMissingProjectorFieldsFromRow,
  type OrderPayload,
} from "@/lib/validations/order";
import type { OrderOperationalStatus } from "@/types/domain";

export type OrderActionResult = { error: string; missingFields?: string[] } | void;

/**
 * Construye la fila de `orders`. Equipo, proyección, instalación y
 * superficie de cada producto ya no van aquí — viven por producto en
 * order_items / order_item_images (ver 0006_item_projection.sql y
 * 0007_item_installation_and_multi_images.sql). Las columnas de `orders`
 * para esos campos quedan sin usar (legacy) para pedidos nuevos.
 */
function buildOrderRow(payload: OrderPayload) {
  return {
    salesperson_id: payload.salesperson_id,
    order_date: payload.order_date,
    // Siempre se incluye la clave (nunca se omite) aunque venga null:
    // rpc_update_order distingue "ausente" (preserva el valor actual) de
    // "presente con null" (limpia la selección) — omitir la clave aquí
    // impediría que el usuario pueda quitar la Business Unit ya elegida.
    business_unit_id: payload.business_unit_id ?? null,
    client_name: payload.client_name,
    supplier_name: payload.supplier_name || null,
    product_type: payload.product_type,
    status: payload.status,
    general_notes: payload.general_notes || null,
    vendor_notes: payload.vendor_notes || null,
    vendor_notes_en: payload.vendor_notes_en || null,
    // Fase 6K (0034) — sobrescritura directa (no "ausente ≠ null"): son
    // campos escalares, no relaciones. `|| null` deja limpiar una fecha ya
    // capturada, igual que el resto de los campos escalares de arriba.
    supplier_commitment_date: payload.supplier_commitment_date || null,
    estimated_reception_date: payload.estimated_reception_date || null,
    scheduled_delivery_date: payload.scheduled_delivery_date || null,
    actual_completion_date: payload.actual_completion_date || null,
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

/**
 * Duplica un pedido completo (nuevo folio/fecha/consecutivo) en una sola
 * transacción (rpc_duplicate_order). La fecha del duplicado se calcula
 * aquí (fecha de negocio, America/Monterrey) y se pasa explícita al RPC:
 * el RPC ya no calcula ninguna fecha por su cuenta (antes usaba
 * `current_date` de Postgres, que corre en UTC en Supabase).
 */
export async function duplicateOrder(sourceOrderId: string): Promise<{ id: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("rpc_duplicate_order", {
    p_source_order_id: sourceOrderId,
    p_order_date: getBusinessToday(),
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
    const [{ data: order }, { data: items }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
    ]);
    if (order && order.product_type === "proyector_gobo") {
      const itemIds = (items ?? []).map((item) => item.id);
      const { data: projectionImages } =
        itemIds.length > 0
          ? await supabase
              .from("order_item_images")
              .select("order_item_id")
              .eq("kind", "projection")
              .in("order_item_id", itemIds)
          : { data: [] as { order_item_id: string }[] };
      const itemsWithProjection = new Set((projectionImages ?? []).map((row) => row.order_item_id));

      const missing = getMissingProjectorFieldsFromRow(
        order,
        (items ?? []).map((item) => ({ ...item, hasProjectionImage: itemsWithProjection.has(item.id) }))
      );
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

/**
 * Cambia el seguimiento operativo del pedido (THÖREN Fase 6H,
 * 0033_order_operational_status.sql) — independiente de `status` de
 * arriba (ver DECISIÓN en la migración). Mismo patrón que setOrderStatus:
 * un UPDATE directo protegido únicamente por la RLS ya existente de
 * `orders` (orders_update_own_or_admin) — sin RPC nueva. El historial
 * (quién/cuándo) lo registra automáticamente el trigger
 * trg_orders_operational_status_history en la base de datos; esta acción
 * nunca escribe en order_operational_status_history directamente (esa
 * tabla ni siquiera tiene policy de INSERT para `authenticated`).
 */
export async function setOrderOperationalStatus(
  orderId: string,
  operationalStatus: OrderOperationalStatus
): Promise<OrderActionResult> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("orders")
    .update({ operational_status: operationalStatus })
    .eq("id", orderId);
  if (error) return { error: mapDbError(error, "No se pudo actualizar el seguimiento del pedido.") };

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
}

/**
 * Elimina un pedido y todos sus registros dependientes (order_items,
 * order_images, order_files) vía rpc_delete_order (ver migración 0005,
 * actualizada en 0006 para también revisar la imagen a proyectar de cada
 * producto). El borrado de BD hace cascade; el RPC devuelve solo las rutas
 * de Storage que quedaron sin ningún referente — es decir, que ningún otro
 * pedido (p. ej. uno duplicado de este) sigue usando. Esas rutas se
 * eliminan de order-media/order-files con el mismo cliente autenticado
 * (RLS), sin service role — igual que el resto de las operaciones de
 * Storage de la app.
 */
export async function deleteOrder(orderId: string): Promise<{ error: string } | void> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("rpc_delete_order", { p_order_id: orderId }).single();

  if (error) {
    return { error: mapDbError(error, "No se pudo eliminar el pedido. Intenta de nuevo.") };
  }

  const mediaPaths = data?.orphaned_media_paths ?? [];
  const filePaths = data?.orphaned_file_paths ?? [];

  if (mediaPaths.length > 0) {
    const { error: mediaError } = await supabase.storage.from("order-media").remove(mediaPaths);
    if (mediaError) console.error("deleteOrder: limpieza de order-media falló", { orderId, message: mediaError.message });
  }
  if (filePaths.length > 0) {
    const { error: fileError } = await supabase.storage.from("order-files").remove(filePaths);
    if (fileError) console.error("deleteOrder: limpieza de order-files falló", { orderId, message: fileError.message });
  }

  revalidatePath("/pedidos");
}
