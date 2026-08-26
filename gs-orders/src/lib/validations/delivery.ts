import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const deliveryTypeEnum = z.enum(["entrega", "instalacion", "entrega_instalacion"]);
const deliveryStatusEnum = z.enum(["programada", "en_proceso", "completada", "cancelada"]);

/** Cabecera común a crear/editar una Entrega — no incluye partidas ni estado. */
export const deliveryDetailsSchema = z.object({
  delivery_type: deliveryTypeEnum,
  scheduled_date: optionalDate,
  actual_datetime: optionalDateTime,
  address: optionalText,
  contact_name: optionalText,
  contact_phone: optionalText,
  responsible_name: optionalText,
  installer_name: optionalText,
  installation_datetime: optionalDateTime,
  installation_notes: optionalText,
  notes: optionalText,
  received_by_name: optionalText,
  customer_observations: optionalText,
});

export const deliveryItemPayloadSchema = z.object({
  catalog_product_id: z.string().uuid(),
  quantity_delivered: z.coerce.number().int().positive("La cantidad a entregar debe ser mayor a cero"),
});

export const createDeliveryPayloadSchema = z.object({
  order_id: z.string().uuid(),
  details: deliveryDetailsSchema,
  items: z.array(deliveryItemPayloadSchema).min(1, "Selecciona al menos una partida"),
});

export type CreateDeliveryPayload = z.infer<typeof createDeliveryPayloadSchema>;
export type DeliveryDetailsPayload = z.infer<typeof deliveryDetailsSchema>;

export const updateDeliveryStatusPayloadSchema = z.object({
  status: deliveryStatusEnum,
});
