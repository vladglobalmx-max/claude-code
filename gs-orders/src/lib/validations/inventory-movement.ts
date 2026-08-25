import { z } from "zod";
import { INVENTORY_MANUAL_MOVEMENT_TYPES } from "@/types/domain";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const inventoryMovementPayloadSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid("Selecciona un almacén"),
  movement_type: z.enum(INVENTORY_MANUAL_MOVEMENT_TYPES as [string, ...string[]]),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a cero"),
  reference: optionalText,
  notes: optionalText,
});

export type InventoryMovementPayload = z.infer<typeof inventoryMovementPayloadSchema>;
