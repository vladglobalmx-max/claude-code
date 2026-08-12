import { z } from "zod";

export const orderItemSchema = z.object({
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  notes: z.string().trim().optional(),
  image_path: z.string().nullable().optional(),

  // Especificaciones técnicas del equipo (antes vivían una sola vez en el
  // pedido; ahora cada producto tiene las suyas — ver 0006_item_projection.sql).
  power: z.string().trim().optional(),
  lens_type: z.string().trim().optional(),
  lens_pending_factory: z.boolean().optional(),

  // Proyección de este producto específico: un pedido puede tener varios
  // proyectores, cada uno proyectando una imagen distinta.
  projection_description: z.string().trim().optional(),
  projection_description_en: z.string().trim().optional(),
  projection_file_path: z.string().nullable().optional(),
  projection_file_name: z.string().nullable().optional(),
  projection_file_type: z.string().nullable().optional(),
  projection_width: z.coerce.number().positive().optional().nullable(),
  projection_height: z.coerce.number().positive().optional().nullable(),
  projection_size_unit: z.enum(["m", "cm"]).optional().nullable(),
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

/**
 * Ya no lleva equipo ni proyección (eso ahora vive en cada order_item, ver
 * orderItemSchema). Solo instalación/superficie, que siguen siendo del
 * pedido completo — no varían por producto.
 */
export const projectorSchema = z.object({
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
export type OrderItemPayload = OrderPayload["items"][number];

const ORDER_LEVEL_REQUIRED_FOR_PEDIDO: { label: string; check: (p: OrderPayload) => boolean }[] = [
  { label: "Vendedor", check: (p) => !!p.salesperson_id },
  { label: "Cliente", check: (p) => !!p.client_name },
  { label: "Proveedor", check: (p) => !!p.supplier_name },
  { label: "Altura de instalación", check: (p) => p.projector?.installation_height != null },
];

const ITEM_PROJECTION_REQUIRED_FOR_PEDIDO: { label: string; check: (item: OrderItemPayload) => boolean }[] = [
  { label: "Descripción de qué se proyectará", check: (item) => !!item.projection_description },
  { label: "Imagen o archivo a proyectar", check: (item) => !!item.projection_file_path },
  { label: "Ancho de proyección", check: (item) => item.projection_width != null },
  { label: "Alto de proyección", check: (item) => item.projection_height != null },
];

function itemLabel(item: OrderItemPayload, index: number) {
  return item.model ? `Producto ${index + 1} (${item.model})` : `Producto ${index + 1}`;
}

/**
 * Regla del §20: antes de marcar un pedido de Proyector/GOBO como "Pedido"
 * deben existir estos campos. No aplica para Borrador — eso siempre se puede
 * guardar incompleto. Cada producto se valida por separado porque cada uno
 * puede proyectar una imagen distinta.
 */
export function getMissingProjectorFields(payload: OrderPayload): string[] {
  if (payload.product_type !== "proyector_gobo" || payload.status !== "pedido") return [];

  const missing = ORDER_LEVEL_REQUIRED_FOR_PEDIDO.filter((rule) => !rule.check(payload)).map((rule) => rule.label);

  payload.items.forEach((item, index) => {
    ITEM_PROJECTION_REQUIRED_FOR_PEDIDO.forEach((rule) => {
      if (!rule.check(item)) missing.push(`${itemLabel(item, index)}: ${rule.label}`);
    });
  });

  return missing;
}

/** Misma regla del §20 pero evaluada directamente sobre filas ya guardadas en BD (orders + order_items). */
export function getMissingProjectorFieldsFromRow(
  order: {
    product_type: string;
    supplier_name: string | null;
    client_name: string;
    salesperson_id: string;
    installation_height: number | null;
  },
  items: {
    model: string;
    projection_description: string | null;
    projection_file_path: string | null;
    projection_width: number | null;
    projection_height: number | null;
  }[]
): string[] {
  if (order.product_type !== "proyector_gobo") return [];
  const missing: string[] = [];
  if (!order.salesperson_id) missing.push("Vendedor");
  if (!order.client_name) missing.push("Cliente");
  if (!order.supplier_name) missing.push("Proveedor");
  if (order.installation_height == null) missing.push("Altura de instalación");

  items.forEach((item, index) => {
    const label = item.model ? `Producto ${index + 1} (${item.model})` : `Producto ${index + 1}`;
    if (!item.projection_description) missing.push(`${label}: Descripción de qué se proyectará`);
    if (!item.projection_file_path) missing.push(`${label}: Imagen o archivo a proyectar`);
    if (item.projection_width == null) missing.push(`${label}: Ancho de proyección`);
    if (item.projection_height == null) missing.push(`${label}: Alto de proyección`);
  });

  return missing;
}
