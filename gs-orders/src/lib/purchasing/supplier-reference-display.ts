/**
 * THÖREN — Supplier Product References (0066). Qué mostrarle a Compras
 * como identificador de una partida de Purchase Order: el snapshot
 * congelado del proveedor (supplier_model_snapshot, con fallback a
 * supplier_sku_snapshot) — NUNCA el modelo interno como sustituto
 * silencioso. `null` significa "falta la referencia", nunca "usa el
 * modelo interno en su lugar" — el llamador decide qué hacer con eso
 * (mostrar advertencia, o el modelo interno claramente etiquetado como
 * interno, ver compras/[id]/page.tsx).
 */
export function resolveSupplierReferenceSnapshot(item: {
  supplier_model_snapshot: string | null;
  supplier_sku_snapshot: string | null;
}): string | null {
  return item.supplier_model_snapshot ?? item.supplier_sku_snapshot ?? null;
}

/** ¿Esta partida está catalogada (tiene un producto real) pero le falta la referencia del proveedor? Una línea libre (sin catalog_product_id) nunca "falta" nada — no aplica. */
export function isMissingSupplierReference(item: {
  catalog_product_id: string | null;
  supplier_model_snapshot: string | null;
  supplier_sku_snapshot: string | null;
}): boolean {
  return item.catalog_product_id !== null && resolveSupplierReferenceSnapshot(item) === null;
}
