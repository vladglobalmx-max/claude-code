"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import {
  reserveInventoryPayloadSchema,
  adjustInventoryReservationPayloadSchema,
  type ReserveInventoryPayload,
} from "@/lib/validations/inventory-reservation";

export type InventoryReservationActionResult = { error: string } | void;

/**
 * THÖREN Fase 6N — reservar/ajustar/liberar inventario desde el detalle
 * del Pedido. Permiso "propio o admin" verificado dentro de cada RPC
 * (mismo criterio que orders_update_own_or_admin, ver DECISIÓN en
 * 0037_inventory_reservations.sql) — no se repite aquí, RLS/la RPC son la
 * autoridad final.
 */
export async function reserveInventory(
  reservationId: string,
  payload: ReserveInventoryPayload
): Promise<InventoryReservationActionResult> {
  const parsed = reserveInventoryPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_reserve_inventory", {
    p_reservation_id: reservationId,
    p_order_id: parsed.data.order_id,
    p_product_id: parsed.data.product_id,
    p_warehouse_id: parsed.data.warehouse_id,
    p_quantity: parsed.data.quantity,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo reservar el inventario.") };
  }

  revalidatePath(`/pedidos/${parsed.data.order_id}`);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${parsed.data.product_id}`);
}

export async function adjustInventoryReservation(
  orderId: string,
  productId: string,
  reservationId: string,
  quantity: number
): Promise<InventoryReservationActionResult> {
  const parsed = adjustInventoryReservationPayloadSchema.safeParse({ reservation_id: reservationId, quantity });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_adjust_inventory_reservation", {
    p_reservation_id: parsed.data.reservation_id,
    p_quantity: parsed.data.quantity,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo ajustar la reserva.") };
  }

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productId}`);
}

export async function releaseInventoryReservation(
  orderId: string,
  productId: string,
  reservationId: string
): Promise<InventoryReservationActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_release_inventory_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo liberar la reserva.") };
  }

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productId}`);
}
