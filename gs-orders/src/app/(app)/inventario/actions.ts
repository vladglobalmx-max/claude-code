"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db-errors";
import { inventoryMovementPayloadSchema, type InventoryMovementPayload } from "@/lib/validations/inventory-movement";

export type InventoryMovementActionResult = { error: string } | void;

/**
 * THÖREN Fase 6M — entradas/salidas/ajustes manuales. Solo ADMIN (RLS +
 * chequeo explícito dentro de rpc_create_inventory_movement). Bloquea
 * cualquier operación que deje ON HAND negativo.
 */
export async function createInventoryMovement(
  movementId: string,
  payload: InventoryMovementPayload
): Promise<InventoryMovementActionResult> {
  const parsed = inventoryMovementPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_inventory_movement", {
    p_movement_id: movementId,
    p_movement: {
      product_id: parsed.data.product_id,
      warehouse_id: parsed.data.warehouse_id,
      movement_type: parsed.data.movement_type,
      quantity: parsed.data.quantity,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo registrar el movimiento.") };
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${parsed.data.product_id}`);
}
