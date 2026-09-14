import { z } from "zod";

/**
 * Línea de una Purchase Requisition — espejo de las constraints de
 * `purchase_requisition_items` (0069_sales_order_procurement.sql:
 * quantity_required > 0). catalog_product_id/description_snapshot/
 * uom_snapshot NO se envían aquí: los resuelve exclusivamente
 * rpc_create_purchase_requisition/rpc_update_purchase_requisition desde
 * la línea de Sales Order de origen — el RPC repite esta misma
 * validación como capa 3 real, esto es solo capa 2.
 */
export const purchaseRequisitionItemSchema = z.object({
  sales_order_item_id: z.string().uuid("Selecciona la línea de la Sales Order"),
  quantity_required: z.coerce.number().int().min(1, "La cantidad requerida debe ser al menos 1"),
  preferred_supplier_id: z.string().uuid().nullable().optional(),
  supplier_product_reference_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().optional(),
});

/**
 * Payload que arma el formulario de Requisición de Compra para
 * rpc_create_purchase_requisition/rpc_update_purchase_requisition.
 * sales_order_id solo lo usa la creación (inmutable después, ver
 * trg_prevent_purchase_requisition_identity_change).
 */
export const purchaseRequisitionPayloadSchema = z.object({
  sales_order_id: z.string().uuid("Selecciona la Sales Order de origen"),
  notes: z.string().trim().optional(),
  items: z.array(purchaseRequisitionItemSchema).default([]),
});

/**
 * Payload de rpc_convert_requisition_to_purchase_order (0069). El array
 * de líneas seleccionadas debe traer al menos una.
 */
export const convertRequisitionToPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid("Selecciona un proveedor"),
  requisition_item_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos una línea para convertir"),
  supplier_commitment_date: z.string().trim().optional(),
  estimated_reception_date: z.string().trim().optional(),
  supplier_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PurchaseRequisitionItemPayload = z.infer<typeof purchaseRequisitionItemSchema>;
export type PurchaseRequisitionPayload = z.infer<typeof purchaseRequisitionPayloadSchema>;
export type ConvertRequisitionToPurchaseOrderPayload = z.infer<typeof convertRequisitionToPurchaseOrderSchema>;
