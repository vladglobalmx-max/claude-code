import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const purchaseOrderItemPayloadSchema = z.object({
  order_item_id: z.string().uuid(),
  quantity_ordered: z.coerce.number().int().positive("La cantidad ordenada debe ser mayor a cero"),
});

export const purchaseOrderPayloadSchema = z.object({
  order_id: z.string().uuid(),
  supplier_id: z.string().uuid("Selecciona un proveedor"),
  po_date: z.string().min(1, "La fecha de orden es obligatoria"),
  supplier_commitment_date: optionalText,
  estimated_reception_date: optionalText,
  supplier_reference: optionalText,
  notes: optionalText,
  items: z.array(purchaseOrderItemPayloadSchema).min(1, "Selecciona al menos una partida"),
});

export type PurchaseOrderPayload = z.infer<typeof purchaseOrderPayloadSchema>;

export const purchaseOrderDetailsPayloadSchema = z.object({
  supplier_commitment_date: optionalText,
  estimated_reception_date: optionalText,
  supplier_reference: optionalText,
  notes: optionalText,
});

export type PurchaseOrderDetailsPayload = z.infer<typeof purchaseOrderDetailsPayloadSchema>;

/**
 * THÖREN 6R.1B-3B — payload de rpc_replace_purchase_order_items (0045):
 * reemplaza el conjunto COMPLETO de partidas, mismo shape que las
 * partidas de creación (purchaseOrderItemPayloadSchema) — nunca un delta.
 */
export const purchaseOrderItemsReplacePayloadSchema = z.object({
  items: z.array(purchaseOrderItemPayloadSchema).min(1, "Debe incluir al menos una partida"),
});

export type PurchaseOrderItemsReplacePayload = z.infer<typeof purchaseOrderItemsReplacePayloadSchema>;

/**
 * THÖREN — Orden de Compra Directa (0081). Sin Pedido/Sales Order/
 * Requisición/cliente. Cada línea acepta producto de catálogo (opcional)
 * O descripción libre — el refine exige al menos uno de los dos, mismo
 * criterio que rpc_create_direct_purchase_order en DB (nunca se confía
 * solo en la validación del cliente).
 */
export const directPurchaseOrderItemPayloadSchema = z
  .object({
    catalog_product_id: z.string().uuid().optional(),
    description: optionalText,
    unit: optionalText,
    supplier_sku: optionalText,
    supplier_model: optionalText,
    quantity_ordered: z.coerce.number().int().positive("La cantidad debe ser mayor a cero"),
    unit_price: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
    tax_percent: z.coerce.number().min(0).max(100).optional().default(0),
  })
  .refine((item) => item.catalog_product_id || item.description, {
    message: "Cada línea debe tener un producto de catálogo o una descripción",
    path: ["description"],
  });

export const DIRECT_PURCHASE_REASONS = ["stock", "interno", "muestras", "refaccion_mantenimiento", "equipo", "proyecto_especial"] as const;

export const directPurchaseOrderPayloadSchema = z.object({
  business_unit_id: z.string().uuid("Selecciona una Business Unit"),
  supplier_id: z.string().uuid("Selecciona un proveedor"),
  direct_purchase_reason: z.enum(DIRECT_PURCHASE_REASONS, { errorMap: () => ({ message: "Selecciona un tipo/motivo de compra" }) }),
  po_date: optionalText,
  required_date: optionalText,
  currency: z.enum(["MXN", "USD"], { errorMap: () => ({ message: "Selecciona una moneda" }) }),
  payment_terms: optionalText,
  destination_warehouse_id: z.string().uuid().optional(),
  document_language: z.enum(["es", "en"]).optional(),
  notes: optionalText,
  items: z.array(directPurchaseOrderItemPayloadSchema).min(1, "Agrega al menos una partida"),
});

export type DirectPurchaseOrderPayload = z.infer<typeof directPurchaseOrderPayloadSchema>;
