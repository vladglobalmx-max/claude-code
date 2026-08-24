import type { QuoteCurrency } from "@/types/domain";
import type { QuoteCatalogProductOption, QuoteItemDraft } from "@/components/quotes/types";
import {
  isProductEligibleForBusinessUnit,
  filterEligibleCatalogProducts as filterEligibleCatalogProductsShared,
  searchCatalogProducts as searchCatalogProductsShared,
  findIncompatibleItems as findIncompatibleItemsShared,
  catalogProductsById as catalogProductsByIdShared,
} from "@/lib/catalog/eligibility";

/**
 * Lógica específica de Quotes sobre el selector de productos del Catálogo
 * Maestro (THÖREN Fase 6D — Integración Catálogo Maestro / Quote Builder).
 * Búsqueda/elegibilidad por Business Unit viven en src/lib/catalog/
 * eligibility.ts (compartidas con Orders desde Fase 6F, pedido explícito
 * de no duplicar esa lógica) — este archivo solo re-exporta esas funciones
 * ya tipadas para QuoteCatalogProductOption/QuoteItemDraft, y agrega lo que
 * SÍ es exclusivo de Quotes: precio (Orders no maneja dinero) y el
 * snapshot inicial de una línea.
 */

export { isProductEligibleForBusinessUnit };

export function filterEligibleCatalogProducts(
  products: QuoteCatalogProductOption[],
  businessUnitId: string
): QuoteCatalogProductOption[] {
  return filterEligibleCatalogProductsShared(products, businessUnitId);
}

/** Búsqueda por SKU, nombre, modelo o marca — substring, insensible a mayúsculas, NUNCA fuzzy. */
export function searchCatalogProducts(products: QuoteCatalogProductOption[], query: string): QuoteCatalogProductOption[] {
  return searchCatalogProductsShared(products, query);
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
  catalogProductsByIdMap: Map<string, QuoteCatalogProductOption>,
  businessUnitId: string
): IncompatibleQuoteItem[] {
  return findIncompatibleItemsShared(items, catalogProductsByIdMap, businessUnitId);
}

export function catalogProductsById(products: QuoteCatalogProductOption[]): Map<string, QuoteCatalogProductOption> {
  return catalogProductsByIdShared(products);
}
