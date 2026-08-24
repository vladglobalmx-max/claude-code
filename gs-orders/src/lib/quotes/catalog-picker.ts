import type { QuoteCurrency } from "@/types/domain";
import type { QuoteCatalogProductOption, QuoteItemDraft } from "@/components/quotes/types";

/**
 * Lógica pura del selector de productos del Catálogo Maestro dentro del
 * Quote Builder (THÖREN Fase 6D — Integración Catálogo Maestro / Quote
 * Builder). Separada de los componentes React para poder probarla con
 * Vitest sin renderizar nada (mismo patrón que quote-totals.ts).
 *
 * Semántica de elegibilidad por Business Unit: idéntica a
 * product_business_units (0019_core_product_catalog_pricing.sql) — lista
 * vacía = compartido con TODAS las Business Units de la organización, 1+
 * ids = solo esas. NUNCA fuzzy, NUNCA se reinterpreta aquí.
 */

const canonicalize = (value: string) => value.trim().toLowerCase();

export function isProductEligibleForBusinessUnit(businessUnitIds: string[], businessUnitId: string): boolean {
  return businessUnitIds.length === 0 || businessUnitIds.includes(businessUnitId);
}

export function filterEligibleCatalogProducts(
  products: QuoteCatalogProductOption[],
  businessUnitId: string
): QuoteCatalogProductOption[] {
  return products.filter((p) => isProductEligibleForBusinessUnit(p.businessUnitIds, businessUnitId));
}

/** Búsqueda por SKU, nombre, modelo o marca — substring, insensible a mayúsculas, NUNCA fuzzy. */
export function searchCatalogProducts(products: QuoteCatalogProductOption[], query: string): QuoteCatalogProductOption[] {
  const q = canonicalize(query);
  if (!q) return products;
  return products.filter((p) =>
    [p.sku, p.name, p.model, p.brand].some((field) => field && canonicalize(field).includes(q))
  );
}

/**
 * Precio sugerido según la moneda de la Quote — MXN -> default_price_mxn,
 * USD -> default_price_usd. Devuelve null (nunca 0) si el producto no tiene
 * precio configurado en esa moneda: la ausencia de dato jamás se convierte
 * en un 0 silencioso (ver caso de prueba "producto sin precio en moneda").
 */
export function pickCatalogPrice(
  product: Pick<QuoteCatalogProductOption, "defaultPriceMxn" | "defaultPriceUsd">,
  currency: QuoteCurrency
): number | null {
  return currency === "MXN" ? product.defaultPriceMxn : product.defaultPriceUsd;
}

/**
 * Parche a aplicar sobre un QuoteItemDraft al elegir un producto del
 * catálogo — snapshot inicial (ver DECISIÓN Snapshot, Fase 6D/6D-cierre):
 * estos valores quedan congelados en el estado del formulario desde este
 * instante, la selección NUNCA vuelve a re-consultar el catálogo. `model`
 * prefiere el campo real `model` del catálogo maestro (0030) y cae a `sku`
 * solo para productos que aún no lo tienen capturado (datos anteriores a
 * Fase 6C) — nunca se inventa un valor. `description` usa el nombre
 * comercial del producto, igual que antes de esta fase (comportamiento sin
 * cambios, solo se documenta explícitamente aquí). `unit` se autocompleta
 * desde product_catalog.unit cuando existe (queda "" si el producto no lo
 * tiene capturado — nunca inventado) y sigue siendo editable en la Quote;
 * `customerRequirements` NUNCA se autocompleta desde el catálogo — nace
 * vacío siempre, solo captura manual (0031, pedido explícito del usuario).
 */
export function buildItemPatchFromCatalogProduct(
  product: QuoteCatalogProductOption,
  currency: QuoteCurrency
): Pick<QuoteItemDraft, "catalogProductId" | "model" | "description" | "unitPrice" | "unit"> {
  const price = pickCatalogPrice(product, currency);
  return {
    catalogProductId: product.id,
    model: product.model || product.sku,
    description: product.name,
    unitPrice: price != null ? String(price) : "",
    unit: product.unit ?? "",
  };
}

export interface IncompatibleQuoteItem {
  item: QuoteItemDraft;
  product: QuoteCatalogProductOption;
}

/**
 * Partidas ya elegidas que dejarían de ser válidas si la Quote cambiara a
 * `businessUnitId` — usado para bloquear el cambio de Business Unit en
 * borrador (Fase 6D §7) en vez de eliminar partidas en silencio. Solo mira
 * partidas con catalogProductId (líneas manuales, sin producto de
 * catálogo, nunca son "incompatibles" — no tienen Business Unit que
 * validar).
 */
export function findIncompatibleItems(
  items: QuoteItemDraft[],
  catalogProductsById: Map<string, QuoteCatalogProductOption>,
  businessUnitId: string
): IncompatibleQuoteItem[] {
  const incompatible: IncompatibleQuoteItem[] = [];
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

export function catalogProductsById(products: QuoteCatalogProductOption[]): Map<string, QuoteCatalogProductOption> {
  return new Map(products.map((p) => [p.id, p]));
}
