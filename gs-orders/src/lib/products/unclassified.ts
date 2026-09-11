/**
 * THÖREN — Catálogo UX (Organization → Business Unit → Product Type →
 * Products). Lógica pura (sin Supabase/Next) para agrupar el catálogo
 * activo por Business Unit y calcular sus contadores — usada por
 * Configuración → Catálogo → "Productos sin clasificar" (herramienta de
 * limpieza masiva de legado con product_type_id NULL, ver 0065).
 *
 * Un producto sin fila en product_business_units (`businessUnitIds: []`)
 * está compartido con TODAS las Business Units de la organización (0019)
 * — se agrupa bajo el bucket sintético `businessUnitId: null` ("Todas las
 * Business Units"), nunca replicado dentro de cada BU real (evitaría
 * contarlo N veces en "Productos" de cada una). Un producto con 2+ BUs
 * explícitas SÍ se cuenta una vez POR CADA una — pertenece genuinamente a
 * varias, y cada Business Unit necesita ver su propio total real.
 */

export interface CatalogProductForGrouping {
  id: string;
  sku: string;
  model: string | null;
  name: string;
  description: string | null;
  created_at: string;
  product_type_id: string | null;
  /** [] = compartido con todas las Business Units de la organización (0 filas en product_business_units). */
  businessUnitIds: string[];
}

export interface BusinessUnitOption {
  id: string;
  name: string;
}

export interface BusinessUnitProductGroup {
  /** null = bucket "Todas las Business Units". */
  businessUnitId: string | null;
  businessUnitName: string;
  totalActiveProducts: number;
  unclassifiedProducts: CatalogProductForGrouping[];
}

const ALL_BUSINESS_UNITS_LABEL = "Todas las Business Units";

/**
 * Agrupa el catálogo ACTIVO de una organización por Business Unit,
 * calculando para cada una el total de productos activos y la lista de
 * los que siguen sin Tipo de Producto (product_type_id null). Grupos sin
 * ningún producto activo se omiten (nada que limpiar ni que contar).
 * Una referencia a una Business Unit que ya no está en `businessUnits`
 * (inactiva/eliminada) se ignora para ESA referencia — nunca inventa un
 * grupo nuevo ni descarta el producto de los demás grupos a los que sí
 * pertenece.
 */
export function groupCatalogByBusinessUnit(
  activeProducts: CatalogProductForGrouping[],
  businessUnits: BusinessUnitOption[]
): BusinessUnitProductGroup[] {
  const groups = new Map<string | null, BusinessUnitProductGroup>();
  groups.set(null, {
    businessUnitId: null,
    businessUnitName: ALL_BUSINESS_UNITS_LABEL,
    totalActiveProducts: 0,
    unclassifiedProducts: [],
  });
  for (const bu of businessUnits) {
    groups.set(bu.id, { businessUnitId: bu.id, businessUnitName: bu.name, totalActiveProducts: 0, unclassifiedProducts: [] });
  }

  for (const product of activeProducts) {
    const keys = product.businessUnitIds.length === 0 ? [null] : product.businessUnitIds;
    for (const key of keys) {
      const group = groups.get(key);
      if (!group) continue;
      group.totalActiveProducts += 1;
      if (product.product_type_id === null) group.unclassifiedProducts.push(product);
    }
  }

  return Array.from(groups.values())
    .filter((g) => g.totalActiveProducts > 0)
    .sort((a, b) => a.businessUnitName.localeCompare(b.businessUnitName));
}

/** Total de productos activos sin clasificar, a través de todos los grupos — para el badge de la página principal de Catálogo. */
export function countUnclassified(activeProducts: { product_type_id: string | null }[]): number {
  return activeProducts.filter((p) => p.product_type_id === null).length;
}
