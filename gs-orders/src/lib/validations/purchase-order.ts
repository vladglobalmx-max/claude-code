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
