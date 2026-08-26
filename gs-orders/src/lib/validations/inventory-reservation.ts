import { z } from "zod";

export const reserveInventoryPayloadSchema = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid("Selecciona un almacén"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a cero"),
});

export type ReserveInventoryPayload = z.infer<typeof reserveInventoryPayloadSchema>;

export const adjustInventoryReservationPayloadSchema = z.object({
  reservation_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a cero"),
});

export type AdjustInventoryReservationPayload = z.infer<typeof adjustInventoryReservationPayloadSchema>;

/** THÖREN Fase 6O — `quantity` es el acumulado SURTIDO absoluto (no un delta), mismo criterio que adjust/recepción de PO. */
export const fulfillInventoryReservationPayloadSchema = z.object({
  reservation_id: z.string().uuid(),
  quantity: z.coerce.number().int().nonnegative("La cantidad surtida no puede ser negativa"),
});

export type FulfillInventoryReservationPayload = z.infer<typeof fulfillInventoryReservationPayloadSchema>;
