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
  active: z.boolean().default(true),
});

export type CatalogProductPayload = z.infer<typeof catalogProductSchema>;
