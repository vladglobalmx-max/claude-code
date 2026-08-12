import { z } from "zod";

export const orderItemSchema = z.object({
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  notes: z.string().trim().optional(),
  image_path: z.string().nullable().optional(),
});

export const orderImageSchema = z.object({
  storage_path: z.string().min(1),
  caption: z.string().trim().optional(),
});

export const orderFileSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  file_type: z.string().optional(),
  file_size: z.number().optional(),
});

export const projectorSchema = z.object({
  model: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1).optional().nullable(),
  power: z.string().trim().optional(),
  lens_type: z.string().trim().optional(),
  lens_pending_factory: z.boolean().optional(),
  description: z.string().trim().optional(),
  description_en: z.string().trim().optional(),
  file: z
    .object({ path: z.string(), name: z.string(), type: z.string().optional() })
    .nullable()
    .optional(),
  width: z.coerce.number().positive().optional().nullable(),
  height: z.coerce.number().positive().optional().nullable(),
  size_unit: z.enum(["m", "cm"]).optional().nullable(),
  installation_height: z.coerce.number().optional().nullable(),
  installation_height_unit: z.enum(["m", "cm", "pies"]).optional().nullable(),
  installation_distance: z.coerce.number().optional().nullable(),
  orientation: z.enum(["piso", "pared", "inclinado", "otro"]).optional().nullable(),
  use: z.enum(["interior", "exterior", "semi_exterior"]).optional().nullable(),
  surface_type: z
    .enum(["piso", "pared", "techo", "equipo", "rack", "anden", "pasillo", "otro"])
    .optional()
    .nullable(),
  surface_material: z
    .enum(["concreto", "epoxico", "asfalto", "metal", "pintura", "otro"])
    .optional()
    .nullable(),
  surface_notes: z.string().trim().optional(),
  surface_notes_en: z.string().trim().optional(),
});

export const orderPayloadSchema = z.object({
  order_date: z.string().min(1, "La fecha es obligatoria"),
  salesperson_id: z.string().uuid("Selecciona un vendedor"),
  client_name: z.string().trim().min(1, "El cliente es obligatorio"),
  supplier_name: z.string().trim().optional(),
  product_type: z.enum(["proyector_gobo", "luminaria", "equipo_seguridad", "refaccion_accesorio", "otro"]),
  status: z.enum(["borrador", "pedido", "cerrado", "cancelado"]).default("borrador"),
  general_notes: z.string().trim().optional(),
  vendor_notes: z.string().trim().optional(),
  vendor_notes_en: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1, "Agrega al menos un producto"),
  images: z.array(orderImageSchema).default([]),
  files: z.array(orderFileSchema).default([]),
  projector: projectorSchema.optional().nullable(),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;

const PROJECTOR_REQUIRED_FOR_PEDIDO: { key: string; label: string; check: (p: OrderPayload) => boolean }[] = [
  { key: "salesperson_id", label: "Vendedor", check: (p) => !!p.salesperson_id },
  { key: "client_name", label: "Cliente", check: (p) => !!p.client_name },
  { key: "supplier_name", label: "Proveedor", check: (p) => !!p.supplier_name },
  { key: "projector.model", label: "Modelo del proyector", check: (p) => !!p.projector?.model },
  {
    key: "projector.quantity",
    label: "Cantidad",
    check: (p) => !!p.projector?.quantity && p.projector.quantity > 0,
  },
  {
    key: "projector.description",
    label: "Descripción de qué se proyectará",
    check: (p) => !!p.projector?.description,
  },
  { key: "projector.file", label: "Imagen o archivo a proyectar", check: (p) => !!p.projector?.file },
  {
    key: "projector.installation_height",
    label: "Altura de instalación",
    check: (p) => p.projector?.installation_height != null,
  },
  { key: "projector.width", label: "Ancho de proyección", check: (p) => p.projector?.width != null },
  { key: "projector.height", label: "Alto de proyección", check: (p) => p.projector?.height != null },
];

/**
 * Regla del §20: antes de marcar un pedido de Proyector/GOBO como "Pedido"
 * deben existir estos campos. No aplica para Borrador — eso siempre se puede
 * guardar incompleto.
 */
export function getMissingProjectorFields(payload: OrderPayload): string[] {
  if (payload.product_type !== "proyector_gobo" || payload.status !== "pedido") return [];
  return PROJECTOR_REQUIRED_FOR_PEDIDO.filter((rule) => !rule.check(payload)).map((rule) => rule.label);
}

/** Misma regla del §20 pero evaluada directamente sobre una fila de la tabla `orders` (ya guardada en BD). */
export function getMissingProjectorFieldsFromRow(order: {
  product_type: string;
  supplier_name: string | null;
  client_name: string;
  salesperson_id: string;
  projector_model: string | null;
  projector_quantity: number | null;
  projection_description: string | null;
  projection_file_path: string | null;
  installation_height: number | null;
  projection_width: number | null;
  projection_height: number | null;
}): string[] {
  if (order.product_type !== "proyector_gobo") return [];
  const missing: string[] = [];
  if (!order.salesperson_id) missing.push("Vendedor");
  if (!order.client_name) missing.push("Cliente");
  if (!order.supplier_name) missing.push("Proveedor");
  if (!order.projector_model) missing.push("Modelo del proyector");
  if (!order.projector_quantity || order.projector_quantity <= 0) missing.push("Cantidad");
  if (!order.projection_description) missing.push("Descripción de qué se proyectará");
  if (!order.projection_file_path) missing.push("Imagen o archivo a proyectar");
  if (order.installation_height == null) missing.push("Altura de instalación");
  if (order.projection_width == null) missing.push("Ancho de proyección");
  if (order.projection_height == null) missing.push("Alto de proyección");
  return missing;
}
