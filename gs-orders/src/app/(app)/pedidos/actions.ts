"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessToday } from "@/lib/business-date";
import { getCurrentOrganizationId, getCurrentOrganizationTimezone } from "@/lib/auth/organization";
import { mapDbError } from "@/lib/db-errors";
import { orderPayloadSchema, type OrderPayload } from "@/lib/validations/order";
import { deleteCustomFieldValuesForEntities, getCustomFieldDefinitions } from "@/lib/custom-fields/data";
import { validateCustomFields } from "@/lib/custom-fields/validation";
import { getMissingRequiredCustomFieldsFromPayload } from "@/lib/custom-fields/completeness";
import { getRequireSupplierBeforeOrder } from "@/lib/orders/process-settings";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";
import type { OrderOperationalStatus } from "@/types/domain";

export type OrderActionResult = { error: string; missingFields?: string[] } | void;

/**
 * THÖREN 8B (Gap 2) — valida los custom fields (entity_type="order_item")
 * ANTES de llamar al RPC, solo para dar un error legible al usuario sin
 * esperar el viaje al servidor. La autoridad REAL (la que no se puede
 * saltar con un payload manipulado) vive en fn_apply_order_item_custom_fields
 * (0058), dentro de la misma transacción que crea/actualiza el pedido —
 * ver rpc_create_order_with_custom_fields/rpc_update_order_with_custom_fields
 * más abajo. Esta validación en TS es una capa adicional de UX, nunca la
 * única.
 */
function validateOrderItemCustomFields(
  definitions: CustomFieldDefinition[],
  items: OrderPayload["items"]
): { ok: true } | { ok: false; error: string } {
  if (definitions.length === 0) return { ok: true };

  for (const item of items) {
    const result = validateCustomFields(definitions, item.custom_field_values ?? {});
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true };
}

/**
 * THÖREN 8D — pre-flight (capa 2 de 3) de "obligatorio antes de Pedido":
 * getMissingRequiredCustomFieldsFromPayload es completamente genérica (cero
 * conocimiento de Thunder/GOBO/product_type) — ver
 * src/lib/custom-fields/completeness.ts. `requiresSupplier` cubre el único
 * requisito CORE configurable (0062, Proveedor — no un custom field, ver
 * DECISIÓN en esa migración) y se combina en la MISMA lista de faltantes.
 * La autoridad REAL (capa 3, la que un payload manipulado no puede
 * saltarse) vive en fn_get_missing_required_before_order_fields (0061/0062),
 * invocada DENTRO de rpc_create_order_with_custom_fields/
 * rpc_update_order_with_custom_fields.
 */
function checkMissingBeforeOrder(
  definitions: CustomFieldDefinition[],
  businessUnitId: string | null,
  status: OrderPayload["status"],
  items: OrderPayload["items"],
  requiresSupplier: boolean,
  supplierName: string | undefined
): { ok: true } | { ok: false; error: string; missingFields: string[] } {
  if (status !== "pedido") return { ok: true };
  const customMissing = getMissingRequiredCustomFieldsFromPayload(definitions, businessUnitId, items);
  const missing = requiresSupplier && !supplierName?.trim() ? ["Proveedor", ...customMissing] : customMissing;
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    error: `No puedes continuar. Completa los campos requeridos: ${missing.join(", ")}`,
    missingFields: missing,
  };
}

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
}

/**
 * Crea el pedido completo (datos + productos + imágenes + archivos +
 * custom fields de cada producto) en una sola transacción vía
 * rpc_create_order_with_custom_fields (0058) — wrapper additivo sobre
 * rpc_create_order (0004) que además valida/guarda custom_field_values
 * DENTRO de la misma transacción: si un campo personalizado requerido
 * falta o un valor es inválido, el RPC entero se revierte, incluido el
 * pedido y el consecutivo de folio del vendedor (THÖREN 8B, Gap 2 — antes
 * el guardado de custom fields era un paso aparte que podía fallar sin
 * revertir el pedido ya creado).
 */
export async function createOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();

  if (organizationId) {
    const definitions = await getCustomFieldDefinitions(supabase, {
      organizationId,
      entityType: "order_item",
      businessUnitId: payload.business_unit_id ?? null,
    });

    const result = validateOrderItemCustomFields(definitions, payload.items);
    if (!result.ok) return { error: result.error };

    const requiresSupplier =
      payload.status === "pedido" ? await getRequireSupplierBeforeOrder(supabase, payload.business_unit_id ?? null) : false;
    const missingCheck = checkMissingBeforeOrder(
      definitions,
      payload.business_unit_id ?? null,
      payload.status,
      payload.items,
      requiresSupplier,
      payload.supplier_name
    );
    if (!missingCheck.ok) return { error: missingCheck.error, missingFields: missingCheck.missingFields };
  }

  const { error } = await supabase.rpc("rpc_create_order_with_custom_fields", {
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

/**
 * Reemplaza campos + productos + imágenes + archivos + custom fields en
 * una sola transacción vía rpc_update_order_with_custom_fields (0058).
 * Ese wrapper ya se encarga de limpiar los custom_field_values huérfanos
 * (rpc_update_order borra y reinserta todas las filas de order_items, ver
 * 0034 — sus ids viejos dejan de existir) y de validar/guardar los nuevos,
 * todo en la misma transacción: si algo falla, ni el pedido ni sus custom
 * fields cambian (THÖREN 8B, Gap 2).
 */
export async function updateOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();

  if (organizationId) {
    const definitions = await getCustomFieldDefinitions(supabase, {
      organizationId,
      entityType: "order_item",
      businessUnitId: payload.business_unit_id ?? null,
    });

    const result = validateOrderItemCustomFields(definitions, payload.items);
    if (!result.ok) return { error: result.error };

    const requiresSupplier =
      payload.status === "pedido" ? await getRequireSupplierBeforeOrder(supabase, payload.business_unit_id ?? null) : false;
    const missingCheck = checkMissingBeforeOrder(
      definitions,
      payload.business_unit_id ?? null,
      payload.status,
      payload.items,
      requiresSupplier,
      payload.supplier_name
    );
    if (!missingCheck.ok) return { error: missingCheck.error, missingFields: missingCheck.missingFields };
  }

  const { error } = await supabase.rpc("rpc_update_order_with_custom_fields", {
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
  const timezone = await getCurrentOrganizationTimezone();

  const { data, error } = await supabase.rpc("rpc_duplicate_order", {
    p_source_order_id: sourceOrderId,
    p_order_date: getBusinessToday(timezone),
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
    // THÖREN 8D — misma autoridad real que rpc_create_order_with_custom_fields/
    // rpc_update_order_with_custom_fields (0061): genérica, sin conocer
    // ningún product_type. "El cliente no es autoridad" también aplica
    // aquí — esta llamada, no el frontend, decide si el pedido puede pasar
    // a "Pedido".
    const { data: missing, error: missingError } = await supabase.rpc("fn_get_missing_required_before_order_fields", {
      p_order_id: orderId,
    });
    if (missingError) {
      return { error: mapDbError(missingError, "No se pudo validar el pedido.") };
    }
    if (missing && missing.length > 0) {
      return {
        error: `No puedes continuar. Completa los campos requeridos: ${missing.join(", ")}`,
        missingFields: missing,
      };
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

  // THÖREN 8B — los order_items desaparecen con el cascade del RPC; sus
  // ids hay que leerlos ANTES (entity_id en custom_field_values no es una
  // FK real, ver 0055, así que nada los borra automáticamente).
  const { data: items } = await supabase.from("order_items").select("id").eq("order_id", orderId);
  const itemIds = (items ?? []).map((item) => item.id);

  const { data, error } = await supabase.rpc("rpc_delete_order", { p_order_id: orderId }).single();

  if (error) {
    return { error: mapDbError(error, "No se pudo eliminar el pedido. Intenta de nuevo.") };
  }

  await deleteCustomFieldValuesForEntities(supabase, "order_item", itemIds);

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
