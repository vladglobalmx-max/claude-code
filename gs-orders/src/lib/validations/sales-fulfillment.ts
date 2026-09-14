import { z } from "zod";

/**
 * Línea de un surtido de Sales Order — espejo de las constraints de
 * `sales_fulfillment_items` (0071_sales_fulfillment_mvp.sql:
 * quantity_requested > 0). catalog_product_id/description_snapshot/
 * uom_snapshot NO se envían aquí: los resuelve exclusivamente
 * rpc_create_sales_fulfillment/rpc_update_sales_fulfillment desde la línea
 * de Sales Order de origen — el RPC repite esta misma validación como capa
 * 3 real, esto es solo capa 2.
 */
export const salesFulfillmentItemSchema = z.object({
  sales_order_item_id: z.string().uuid("Selecciona la línea de la Sales Order"),
  quantity_requested: z.coerce.number().int().min(1, "La cantidad a surtir debe ser al menos 1"),
});

/**
 * Payload que arma el formulario de Surtido para
 * rpc_create_sales_fulfillment/rpc_update_sales_fulfillment.
 * sales_order_id solo lo usa la creación (inmutable después, ver
 * trg_prevent_sales_fulfillment_field_change).
 */
export const salesFulfillmentPayloadSchema = z.object({
  sales_order_id: z.string().uuid("Selecciona la Sales Order de origen"),
  warehouse_id: z.string().uuid("Selecciona el almacén de surtido"),
  delivery_contact: z.string().trim().optional(),
  delivery_notes: z.string().trim().optional(),
  items: z.array(salesFulfillmentItemSchema).default([]),
});

export type SalesFulfillmentItemPayload = z.infer<typeof salesFulfillmentItemSchema>;
export type SalesFulfillmentPayload = z.infer<typeof salesFulfillmentPayloadSchema>;
