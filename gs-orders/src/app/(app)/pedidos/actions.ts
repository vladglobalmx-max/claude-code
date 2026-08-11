"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

    projector_model: p?.model || null,
    projector_quantity: p?.quantity ?? null,
    projector_power: p?.power || null,
    projector_lens_type: p?.lens_pending_factory ? "Por definir por fábrica" : p?.lens_type || null,
    projector_lens_pending_factory: p?.lens_pending_factory ?? false,

    projection_description: p?.description || null,
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

export async function createOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    ...buildOrderRow(payload),
  });
  if (orderError) return { error: orderError.message };

  const { error: itemsError } = await supabase.from("order_items").insert(
    payload.items.map((item, index) => ({
      order_id: orderId,
      position: index,
      model: item.model,
      description: item.description || null,
      quantity: item.quantity,
      notes: item.notes || null,
      image_path: item.image_path || null,
    }))
  );
  if (itemsError) return { error: itemsError.message };

  if (payload.images.length > 0) {
    await supabase.from("order_images").insert(
      payload.images.map((img, index) => ({
        order_id: orderId,
        position: index,
        storage_path: img.storage_path,
        caption: img.caption || null,
      }))
    );
  }

  if (payload.files.length > 0) {
    await supabase.from("order_files").insert(
      payload.files.map((file) => ({
        order_id: orderId,
        storage_path: file.storage_path,
        file_name: file.file_name,
        file_type: file.file_type || null,
        file_size: file.file_size ?? null,
      }))
    );
  }

  revalidatePath("/pedidos");
  redirect(`/pedidos/${orderId}`);
}

export async function updateOrder(orderId: string, payload: OrderPayload): Promise<OrderActionResult> {
  const invalid = validatePayload(payload);
  if (invalid) return invalid;

  const supabase = createSupabaseServerClient();

  const { error: orderError } = await supabase
    .from("orders")
    .update(buildOrderRow(payload))
    .eq("id", orderId);
  if (orderError) return { error: orderError.message };

  // order_items se reemplazan por completo: es una lista estructurada simple,
  // sin efectos secundarios en Storage al reescribirla.
  await supabase.from("order_items").delete().eq("order_id", orderId);
  const { error: itemsError } = await supabase.from("order_items").insert(
    payload.items.map((item, index) => ({
      order_id: orderId,
      position: index,
      model: item.model,
      description: item.description || null,
      quantity: item.quantity,
      notes: item.notes || null,
      image_path: item.image_path || null,
    }))
  );
  if (itemsError) return { error: itemsError.message };

  // order_images / order_files también se reemplazan por completo: son la
  // lista actual del formulario, ya subida a Storage bajo la carpeta del pedido.
  await supabase.from("order_images").delete().eq("order_id", orderId);
  if (payload.images.length > 0) {
    await supabase.from("order_images").insert(
      payload.images.map((img, index) => ({
        order_id: orderId,
        position: index,
        storage_path: img.storage_path,
        caption: img.caption || null,
      }))
    );
  }

  await supabase.from("order_files").delete().eq("order_id", orderId);
  if (payload.files.length > 0) {
    await supabase.from("order_files").insert(
      payload.files.map((file) => ({
        order_id: orderId,
        storage_path: file.storage_path,
        file_name: file.file_name,
        file_type: file.file_type || null,
        file_size: file.file_size ?? null,
      }))
    );
  }

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  redirect(`/pedidos/${orderId}`);
}

export async function duplicateOrder(sourceOrderId: string): Promise<{ id: string }> {
  const supabase = createSupabaseServerClient();

  const { data: source, error: sourceError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", sourceOrderId)
    .single();
  if (sourceError || !source) throw new Error("Pedido original no encontrado");

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", sourceOrderId);
  const { data: images } = await supabase.from("order_images").select("*").eq("order_id", sourceOrderId);
  const { data: files } = await supabase.from("order_files").select("*").eq("order_id", sourceOrderId);

  const newOrderId = randomUUID();

  const {
    id: _id,
    folio: _folio,
    sequence_number: _seq,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...copyable
  } = source;

  const { error: insertError } = await supabase.from("orders").insert({
    id: newOrderId,
    ...copyable,
    order_date: new Date().toISOString().slice(0, 10),
    status: "borrador",
  });
  if (insertError) throw new Error(insertError.message);

  if (items && items.length > 0) {
    await supabase.from("order_items").insert(
      items.map(({ id: _itemId, order_id: _orderId, created_at: _c, updated_at: _u, ...rest }) => ({
        ...rest,
        order_id: newOrderId,
      }))
    );
  }

  if (images && images.length > 0) {
    await supabase.from("order_images").insert(
      images.map(({ id: _imgId, order_id: _orderId, created_at: _c, ...rest }) => ({
        ...rest,
        order_id: newOrderId,
      }))
    );
  }

  if (files && files.length > 0) {
    await supabase.from("order_files").insert(
      files.map(({ id: _fileId, order_id: _orderId, created_at: _c, ...rest }) => ({
        ...rest,
        order_id: newOrderId,
      }))
    );
  }

  revalidatePath("/pedidos");
  return { id: newOrderId };
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
  if (error) return { error: error.message };

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
}
