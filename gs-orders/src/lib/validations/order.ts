import { z } from "zod";

const orderItemImageSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
});

export const orderItemSchema = z.object({
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  notes: z.string().trim().optional(),
  image_path: z.string().nullable().optional(),

  // Referencia opcional (solo trazabilidad) al producto del catálogo del
  // que se copió este producto, y color del producto — ver
  // 0009_product_catalog.sql. No se vuelve a consultar el catálogo con
  // este id: todo lo que se muestra ya viene en los demás campos.
  catalog_product_id: z.string().uuid().nullable().optional(),
  color: z.string().trim().optional(),

  // Datos operativos por línea (0029, Fase 6F). `unit` se autocompleta
  // desde product_catalog.unit al elegir un producto del catálogo (sigue
  // editable); `customer_requirements` es captura operativa manual, nunca
  // se infiere del catálogo.
  unit: z.string().trim().optional(),
  customer_requirements: z.string().trim().optional(),

  // Especificaciones técnicas del equipo (antes vivían una sola vez en el
  // pedido; ahora cada producto tiene las suyas — ver 0006_item_projection.sql).
  power: z.string().trim().optional(),
  lens_type: z.string().trim().optional(),
  lens_pending_factory: z.boolean().optional(),

  // Proyección de este producto específico: un pedido puede tener varios
  // proyectores, cada uno proyectando una o varias imágenes distintas.
  projection_description: z.string().trim().optional(),
  projection_description_en: z.string().trim().optional(),
  projection_width: z.coerce.number().positive().optional().nullable(),
  projection_height: z.coerce.number().positive().optional().nullable(),
  projection_size_unit: z.enum(["m", "cm"]).optional().nullable(),

  // Instalación y superficie de este producto (antes eran columnas
  // globales del pedido — ver 0007_item_installation_and_multi_images.sql).
  installation_height: z.coerce.number().optional().nullable(),
  installation_height_unit: z.enum(["m", "cm", "pies"]).optional().nullable(),
  installation_distance: z.coerce.number().optional().nullable(),
  installation_orientation: z.enum(["piso", "pared", "inclinado", "otro"]).optional().nullable(),
  installation_use: z.enum(["interior", "exterior", "semi_exterior"]).optional().nullable(),
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

  // Imágenes de referencia del producto e imágenes a proyectar (0 o varias
  // de cada una).
  reference_images: z.array(orderItemImageSchema).default([]),
  projection_images: z.array(orderItemImageSchema).default([]),

  // THÖREN 8B — valores de custom_field_definitions (entity_type=
  // "order_item") por `key`, crudos (sin tipar todavía: validateCustomFields
  // los tipa/valida server-side en pedidos/actions.ts). Opcional (no
  // `.default()`) para no obligar a los constructores existentes de
  // OrderItemPayload a incluirla — ausente se trata igual que {}. El RPC
  // ignora esta clave (jsonb_array_elements + extracción explícita por
  // columna, ver 0034_order_commitment_dates.sql) — nunca llega a order_items.
  custom_field_values: z.record(z.string()).optional(),
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

export const orderPayloadSchema = z.object({
  order_date: z.string().min(1, "La fecha es obligatoria"),
  salesperson_id: z.string().uuid("Selecciona un vendedor"),
  // Nullable a propósito (0022_orders_v2_foundation.sql, Fase 6F): un
  // Order puede no tener Business Unit elegida — el chequeo de elegibilidad
  // de catálogo por BU (0032) se omite por completo en ese caso, nunca se
  // inventa un valor.
  business_unit_id: z.string().uuid().nullable().optional(),
  client_name: z.string().trim().min(1, "El cliente es obligatorio"),
  supplier_name: z.string().trim().optional(),
  // Ya no es un enum fijo: los tipos válidos viven en product_types (ver
  // 0010_product_types.sql) y se administran desde Configuración. La
  // integridad real (que el código exista) la garantiza la FK
  // orders_product_type_fkey a nivel de base de datos.
  product_type: z.string().trim().min(1, "El tipo de producto es obligatorio"),
  status: z.enum(["borrador", "pedido", "cerrado", "cancelado"]).default("borrador"),
  general_notes: z.string().trim().optional(),
  vendor_notes: z.string().trim().optional(),
  vendor_notes_en: z.string().trim().optional(),
  // Fase 6K (0034) — fechas compromiso de cumplimiento logístico, captura
  // manual opcional. Sobrescritura directa en rpc_update_order (no aplican
  // "ausente ≠ null": son campos escalares, no relaciones).
  supplier_commitment_date: z.string().trim().optional(),
  estimated_reception_date: z.string().trim().optional(),
  scheduled_delivery_date: z.string().trim().optional(),
  actual_completion_date: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1, "Agrega al menos un producto"),
  images: z.array(orderImageSchema).default([]),
  files: z.array(orderFileSchema).default([]),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
export type OrderItemPayload = OrderPayload["items"][number];

const ORDER_LEVEL_REQUIRED_FOR_PEDIDO: { label: string; check: (p: OrderPayload) => boolean }[] = [
  { label: "Vendedor", check: (p) => !!p.salesperson_id },
  { label: "Cliente", check: (p) => !!p.client_name },
  { label: "Proveedor", check: (p) => !!p.supplier_name },
];

const ITEM_PROJECTOR_REQUIRED_FOR_PEDIDO: { label: string; check: (item: OrderItemPayload) => boolean }[] = [
  { label: "Descripción de qué se proyectará", check: (item) => !!item.projection_description },
  { label: "Imagen o archivo a proyectar", check: (item) => item.projection_images.length > 0 },
  { label: "Ancho de proyección", check: (item) => item.projection_width != null },
  { label: "Alto de proyección", check: (item) => item.projection_height != null },
  { label: "Altura de instalación", check: (item) => item.installation_height != null },
];

function itemLabel(item: OrderItemPayload, index: number) {
  return item.model ? `Producto ${index + 1} (${item.model})` : `Producto ${index + 1}`;
}

/**
 * Regla del §20: antes de marcar un pedido de Proyector/GOBO como "Pedido"
 * deben existir estos campos. No aplica para Borrador — eso siempre se puede
 * guardar incompleto. Cada producto se valida por separado: cada uno tiene
 * su propia proyección, instalación y superficie.
 */
export function getMissingProjectorFields(payload: OrderPayload): string[] {
  if (payload.product_type !== "proyector_gobo" || payload.status !== "pedido") return [];

  const missing = ORDER_LEVEL_REQUIRED_FOR_PEDIDO.filter((rule) => !rule.check(payload)).map((rule) => rule.label);

  payload.items.forEach((item, index) => {
    ITEM_PROJECTOR_REQUIRED_FOR_PEDIDO.forEach((rule) => {
      if (!rule.check(item)) missing.push(`${itemLabel(item, index)}: ${rule.label}`);
    });
  });

  return missing;
}

/** Misma regla del §20 pero evaluada directamente sobre filas ya guardadas en BD (orders + order_items + order_item_images). */
export function getMissingProjectorFieldsFromRow(
  order: {
    product_type: string;
    supplier_name: string | null;
    client_name: string;
    salesperson_id: string;
  },
  items: {
    model: string;
    projection_description: string | null;
    projection_width: number | null;
    projection_height: number | null;
    installation_height: number | null;
    hasProjectionImage: boolean;
  }[]
): string[] {
  if (order.product_type !== "proyector_gobo") return [];
  const missing: string[] = [];
  if (!order.salesperson_id) missing.push("Vendedor");
  if (!order.client_name) missing.push("Cliente");
  if (!order.supplier_name) missing.push("Proveedor");

  items.forEach((item, index) => {
    const label = item.model ? `Producto ${index + 1} (${item.model})` : `Producto ${index + 1}`;
    if (!item.projection_description) missing.push(`${label}: Descripción de qué se proyectará`);
    if (!item.hasProjectionImage) missing.push(`${label}: Imagen o archivo a proyectar`);
    if (item.projection_width == null) missing.push(`${label}: Ancho de proyección`);
    if (item.projection_height == null) missing.push(`${label}: Alto de proyección`);
    if (item.installation_height == null) missing.push(`${label}: Altura de instalación`);
  });

  return missing;
}
