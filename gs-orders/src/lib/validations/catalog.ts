import { z } from "zod";

/**
 * Payload del formulario de administración del catálogo (Configuración →
 * Catálogo de productos). No incluye `id` (lo genera el cliente con
 * randomUUID, igual que orderId en pedidos) ni timestamps (los pone la BD).
 */
export const catalogProductSchema = z.object({
  category: z.string().trim().min(1, "La categoría es obligatoria"),
  sku: z.string().trim().min(1, "El modelo/SKU es obligatorio"),
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: z.string().trim().optional(),
  image_path: z.string().nullable().optional(),
  power: z.string().trim().optional(),
  color: z.string().trim().optional(),
  lens_type: z.string().trim().optional(),
  technical_notes: z.string().trim().optional(),
  // Precio sugerido/default (ver 0019_core_product_catalog_pricing.sql) —
  // nunca source of truth histórico, sin conversión entre monedas.
  default_price_mxn: z.coerce.number().min(0, "El precio no puede ser negativo").optional().nullable(),
  default_price_usd: z.coerce.number().min(0, "El precio no puede ser negativo").optional().nullable(),
  // Business Units específicas (vacío = compartido con todas las de la
  // organización — ver product_business_units, 0019).
  business_unit_ids: z.array(z.string().uuid()).default([]),
  active: z.boolean().default(true),
});

export type CatalogProductPayload = z.infer<typeof catalogProductSchema>;
