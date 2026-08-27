/**
 * Construye el mapa productId -> [businessUnitId] a partir de TODAS las
 * filas de product_business_units (ver fetchAllPages, paginated-fetch.ts)
 * — misma lógica exacta que estaba duplicada inline en 4 páginas
 * (cotizaciones/nueva, cotizaciones/[id]/editar, pedidos/nuevo,
 * pedidos/[id]/editar), ahora compartida para no repetirla una quinta vez
 * y para poder probarla directamente. Semántica sin cambios (0019/
 * eligibility.ts): 0 filas para un producto = compartido con TODAS las
 * Business Units — este mapa no decide eso, solo refleja fielmente las
 * asociaciones reales; `isProductEligibleForBusinessUnit`
 * (lib/catalog/eligibility.ts) es quien interpreta un array vacío como
 * "todas".
 */
export interface ProductBusinessUnitRow {
  product_id: string;
  business_unit_id: string;
}

export function buildBusinessUnitIdsByProduct(rows: ProductBusinessUnitRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.product_id) ?? [];
    list.push(row.business_unit_id);
    map.set(row.product_id, list);
  }
  return map;
}
