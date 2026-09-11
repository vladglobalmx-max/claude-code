import { z } from "zod";

/**
 * THÖREN — Supplier Product References (0066): forma de una fila de
 * "Proveedores / Referencias" en Configuración → Catálogo → Editar
 * producto. Un producto puede tener varias (1 por proveedor) — el
 * conjunto completo se reemplaza al guardar (mismo criterio que
 * syncBusinessUnits en catalogo/actions.ts). `catalog_product_id` NUNCA
 * viaja aquí — lo fija el server action con el id de la página, nunca el
 * cliente.
 */
export const supplierProductReferenceRowSchema = z
  .object({
    supplierId: z.string().uuid("Selecciona un proveedor"),
    supplierSku: z.string().trim().optional(),
    supplierModel: z.string().trim().optional(),
    supplierDescription: z.string().trim().optional(),
    supplierUom: z.string().trim().optional(),
    preferred: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  // Debe existir al menos SKU o modelo del proveedor — espeja
  // supplier_product_references_has_reference (0066).
  .refine((row) => !!row.supplierSku?.trim() || !!row.supplierModel?.trim(), {
    message: "Cada referencia necesita al menos el SKU o el modelo del proveedor.",
    path: ["supplierSku"],
  })
  // Espeja supplier_product_references_preferred_requires_active (0066).
  .refine((row) => !row.preferred || row.active, {
    message: "Una referencia preferida no puede estar inactiva.",
    path: ["preferred"],
  });

export const supplierProductReferencesPayloadSchema = z
  .array(supplierProductReferenceRowSchema)
  // Espeja supplier_product_references_unique (0066) — nunca dos filas
  // del mismo proveedor para el mismo producto.
  .refine((rows) => new Set(rows.map((r) => r.supplierId)).size === rows.length, {
    message: "No puedes repetir el mismo proveedor dos veces para este producto.",
  })
  // Espeja supplier_product_references_preferred_unique (0066) — a lo
  // sumo un preferido por producto.
  .refine((rows) => rows.filter((r) => r.preferred).length <= 1, {
    message: "Solo puede haber un proveedor preferido por producto.",
  });

export type SupplierProductReferenceRow = z.infer<typeof supplierProductReferenceRowSchema>;
