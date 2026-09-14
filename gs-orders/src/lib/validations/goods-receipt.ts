import { z } from "zod";

/**
 * Línea de una recepción de mercancía — espejo de las constraints de
 * `goods_receipt_items` (0070_receiving_inventory_mvp.sql:
 * quantity_received > 0). catalog_product_id/description_snapshot/
 * uom_snapshot NO se envían aquí: los resuelve exclusivamente
 * rpc_create_goods_receipt/rpc_update_goods_receipt desde la partida de
 * Purchase Order de origen — el RPC repite esta misma validación como
 * capa 3 real, esto es solo capa 2.
 */
export const goodsReceiptItemSchema = z.object({
  purchase_order_item_id: z.string().uuid("Selecciona la partida de la Purchase Order"),
  quantity_received: z.coerce.number().int().min(1, "La cantidad recibida debe ser al menos 1"),
});

/**
 * Payload que arma el formulario de Recepción de Mercancía para
 * rpc_create_goods_receipt/rpc_update_goods_receipt.
 * purchase_order_id solo lo usa la creación (inmutable después, ver
 * trg_prevent_goods_receipt_identity_change).
 */
export const goodsReceiptPayloadSchema = z.object({
  purchase_order_id: z.string().uuid("Selecciona la Purchase Order de origen"),
  warehouse_id: z.string().uuid("Selecciona el almacén de recepción"),
  received_at: z.string().trim().optional(),
  supplier_document_number: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  items: z.array(goodsReceiptItemSchema).default([]),
});

export type GoodsReceiptItemPayload = z.infer<typeof goodsReceiptItemSchema>;
export type GoodsReceiptPayload = z.infer<typeof goodsReceiptPayloadSchema>;
