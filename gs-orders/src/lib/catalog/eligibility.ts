/**
 * Lógica pura, compartida entre Quotes (Fase 6D) y Orders (Fase 6F), del
 * Catálogo Maestro: búsqueda por SKU/nombre/modelo/marca y elegibilidad
 * por Business Unit. Extraída de src/lib/quotes/catalog-picker.ts para no
 * duplicar la misma lógica en Orders (pedido explícito de Fase 6F §2) —
 * ninguno de los dos dominios reimplementa su propia versión.
 *
 * Semántica de elegibilidad por Business Unit: idéntica en todo el
 * proyecto (product_business_units, 0019_core_product_catalog_pricing.sql)
 * — lista vacía = compartido con TODAS las Business Units de la
 * organización, 1+ ids = solo esas. NUNCA fuzzy, NUNCA se reinterpreta
 * aquí.
 *
 * Genérico sobre formas mínimas (structural typing) para que cada dominio
 * siga usando su propio tipo de producto/línea (QuoteCatalogProductOption/
 * QuoteItemDraft vs CatalogProductOption/ProductItemDraft de Orders) sin
 * conversiones ni acoplamiento entre `components/quotes` y
 * `components/orders`.
 */

const canonicalize = (value: string) => value.trim().toLowerCase();

export interface EligibilitySource {
  businessUnitIds: string[];
}

export function isProductEligibleForBusinessUnit(businessUnitIds: string[], businessUnitId: string): boolean {
  return businessUnitIds.length === 0 || businessUnitIds.includes(businessUnitId);
}

export function filterEligibleCatalogProducts<T extends EligibilitySource>(products: T[], businessUnitId: string): T[] {
  return products.filter((p) => isProductEligibleForBusinessUnit(p.businessUnitIds, businessUnitId));
}

export interface SearchableSource {
  sku: string;
  name: string;
  model: string | null;
  brand: string | null;
}

/** Búsqueda por SKU, nombre, modelo o marca — substring, insensible a mayúsculas, NUNCA fuzzy. */
export function searchCatalogProducts<T extends SearchableSource>(products: T[], query: string): T[] {
  const q = canonicalize(query);
  if (!q) return products;
  return products.filter((p) =>
    [p.sku, p.name, p.model, p.brand].some((field) => field && canonicalize(field).includes(q))
  );
}

export interface CatalogItemSource {
  catalogProductId: string | null;
}

export interface IncompatibleCatalogItem<TItem, TProduct> {
  item: TItem;
  product: TProduct;
}

/**
 * Líneas ya elegidas que dejarían de ser válidas si el documento (Quote u
 * Order) cambiara a `businessUnitId` — usado para bloquear el cambio de
 * Business Unit en vez de eliminar líneas en silencio. Solo mira líneas
 * con catalogProductId (líneas manuales, sin producto de catálogo, nunca
 * son "incompatibles" — no tienen Business Unit que validar).
 */
export function findIncompatibleItems<TItem extends CatalogItemSource, TProduct extends EligibilitySource>(
  items: TItem[],
  catalogProductsById: Map<string, TProduct>,
  businessUnitId: string
): IncompatibleCatalogItem<TItem, TProduct>[] {
  const incompatible: IncompatibleCatalogItem<TItem, TProduct>[] = [];
  for (const item of items) {
    if (!item.catalogProductId) continue;
    const product = catalogProductsById.get(item.catalogProductId);
    if (!product) continue;
    if (!isProductEligibleForBusinessUnit(product.businessUnitIds, businessUnitId)) {
      incompatible.push({ item, product });
    }
  }
  return incompatible;
}

export function catalogProductsById<T extends { id: string }>(products: T[]): Map<string, T> {
  return new Map(products.map((p) => [p.id, p]));
}
