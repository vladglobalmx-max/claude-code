"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import {
  createDeliveryPayloadSchema,
  deliveryDetailsSchema,
  updateDeliveryStatusPayloadSchema,
  type CreateDeliveryPayload,
  type DeliveryDetailsPayload,
} from "@/lib/validations/delivery";
import type { DeliveryFileKind } from "@/types/domain";
import { deleteOrderMedia, deleteOrderFile } from "../pedidos/storage-actions";

export type DeliveryActionResult = { error: string } | void;

function revalidateDelivery(deliveryId: string, orderId: string) {
  revalidatePath(`/entregas/${deliveryId}`);
  revalidatePath("/entregas");
  revalidatePath(`/pedidos/${orderId}`);
}

/**
 * THÖREN Fase 6P — crea una Entrega + sus partidas. Permiso "propio o
 * admin" verificado dentro de rpc_create_delivery (SECURITY DEFINER, ver
 * DECISIÓN en 0039_deliveries.sql) — no se repite aquí.
 */
export async function createDelivery(deliveryId: string, payload: CreateDeliveryPayload): Promise<DeliveryActionResult> {
  const parsed = createDeliveryPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_delivery", {
    p_delivery_id: deliveryId,
    p_delivery: { order_id: parsed.data.order_id, ...parsed.data.details },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la entrega.") };
  }

  revalidateDelivery(deliveryId, parsed.data.order_id);
}

export async function updateDeliveryStatus(deliveryId: string, orderId: string, status: string): Promise<DeliveryActionResult> {
  const parsed = updateDeliveryStatusPayloadSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Estado inválido" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_delivery_status", {
    p_delivery_id: deliveryId,
    p_status: parsed.data.status,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el estado de la entrega.") };
  }

  revalidateDelivery(deliveryId, orderId);
}

export async function updateDeliveryDetails(
  deliveryId: string,
  orderId: string,
  payload: DeliveryDetailsPayload
): Promise<DeliveryActionResult> {
  const parsed = deliveryDetailsSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_delivery_details", {
    p_delivery_id: deliveryId,
    p_delivery: parsed.data,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar la entrega.") };
  }

  revalidateDelivery(deliveryId, orderId);
}

/**
 * THÖREN Fase 6P §5 — evidencia. El archivo YA se subió a Storage (bucket
 * order-media/order-files existente, ver uploadOrderMedia/uploadOrderFile
 * en pedidos/storage-actions.ts) — esta acción solo registra la fila en
 * delivery_files, con RLS "propio o admin" idéntica a Orders.
 */
export async function attachDeliveryFile(
  deliveryId: string,
  orderId: string,
  file: { path: string; name: string; type: string; size: number },
  kind: DeliveryFileKind
): Promise<DeliveryActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("delivery_files").insert({
    delivery_id: deliveryId,
    kind,
    storage_path: file.path,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo adjuntar la evidencia.") };
  }

  revalidateDelivery(deliveryId, orderId);
}

export async function removeDeliveryFile(fileId: string, deliveryId: string, orderId: string): Promise<DeliveryActionResult> {
  const supabase = createSupabaseServerClient();
  const { data: file } = await supabase.from("delivery_files").select("kind, storage_path").eq("id", fileId).maybeSingle();

  const { error } = await supabase.from("delivery_files").delete().eq("id", fileId);
  if (error) {
    return { error: mapDbError(error, "No se pudo eliminar la evidencia.") };
  }

  if (file) {
    if (file.kind === "foto") await deleteOrderMedia(file.storage_path);
    else await deleteOrderFile(file.storage_path);
  }

  revalidateDelivery(deliveryId, orderId);
}
