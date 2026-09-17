import { canonicalize } from "@/lib/products/import-parsing";

/**
 * Predicado de búsqueda/filtro del Catálogo de productos
 * (configuracion/catalogo/page.tsx) — extraído tal cual, sin cambios de
 * comportamiento, para poder probarlo contra un catálogo completo
 * (>1,000 filas) sin depender de Supabase/Next. Ver fix "FIX CATÁLOGO
 * >1,000 PRODUCTOS": el bug real no estaba en este predicado (opera
 * correctamente sobre lo que recibe) sino en que antes recibía un
 * `allProducts` truncado por `max_rows` — ver paginated-fetch.ts.
 */
export interface CatalogFilterRow {
  sku: string;
  name: string;
  model: string | null;
  product_type_id: string | null;
  active: boolean;
  product_business_units: { business_unit_id: string }[] | null;
}

export interface CatalogFilterParams {
  q?: string;
  bu?: string;
  tipo?: string;
  estado?: string;
}

export function filterCatalogRows<T extends CatalogFilterRow>(products: T[], params: CatalogFilterParams): T[] {
  const q = params.q?.trim() ? canonicalize(params.q.trim()) : null;
  // Ajuste UX — sin `estado` explícito, default a "Activo" (antes mostraba
  // ambos): un producto recién desactivado (individual o bulk) debe
  // desaparecer del catálogo al abrirlo, no seguir visible bajo lo que
  // parecía "sin filtro". "todos" es ahora el único valor que muestra
  // activos + inactivos — ver catalog-filters.tsx.
  const estado = params.estado || "activo";

  return products.filter((p) => {
    if (q) {
      const haystack = canonicalize([p.sku, p.name, p.model ?? ""].join(" "));
      if (!haystack.includes(q)) return false;
    }
    if (params.bu) {
      const buRows = p.product_business_units ?? [];
      const matchesBu = buRows.length === 0 || buRows.some((r) => r.business_unit_id === params.bu);
      if (!matchesBu) return false;
    }
    if (params.tipo && p.product_type_id !== params.tipo) return false;
    if (estado === "activo" && !p.active) return false;
    if (estado === "inactivo" && p.active) return false;
    return true;
  });
}
