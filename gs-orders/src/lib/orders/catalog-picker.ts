import type { CatalogProductOption, ProductItemDraft } from "@/components/orders/types";
import {
  isProductEligibleForBusinessUnit,
  filterEligibleCatalogProducts as filterEligibleCatalogProductsShared,
  searchCatalogProducts as searchCatalogProductsShared,
  findIncompatibleItems as findIncompatibleItemsShared,
  catalogProductsById as catalogProductsByIdShared,
} from "@/lib/catalog/eligibility";

/**
 * Lógica específica de Orders sobre el selector de productos del Catálogo
 * Maestro (THÖREN Fase 6F — homologación con el Quote Builder de Fase 6D).
 * Búsqueda/elegibilidad por Business Unit viven en src/lib/catalog/
 * eligibility.ts (compartidas con Quotes, pedido explícito de no duplicar
 * esa lógica) — este archivo solo re-exporta esas funciones ya tipadas
 * para CatalogProductOption/ProductItemDraft, y agrega lo exclusivo de
 * Orders: filtrar además por `active` (0032 rechaza a nivel RPC un
 * catalog_product_id inactivo en una selección nueva — el picker no debe
 * ni ofrecerlo) y el snapshot inicial de una línea SIN precio (Orders no
 * maneja dinero).
 */

export { isProductEligibleForBusinessUnit };

/**
 * Productos elegibles para selección NUEVA en el picker: activos Y
 * elegibles para la Business Unit del Order. Un producto histórico ya
 * inactivo asociado a una línea existente NO pasa por aquí — se muestra
 * aparte, resuelto directamente por su id (ver DECISIÓN "producto
 * histórico inactivo", Fase 6F) — este filtro es solo para lo que el
 * picker OFRECE, nunca para lo que ya está en el Order.
 */
export function filterEligibleCatalogProducts(
  products: CatalogProductOption[],
  businessUnitId: string
): CatalogProductOption[] {
  return filterEligibleCatalogProductsShared(
    products.filter((p) => p.active),
    businessUnitId
  );
}

/** Búsqueda por SKU, nombre, modelo o marca — substring, insensible a mayúsculas, NUNCA fuzzy. */
export function searchCatalogProducts(products: CatalogProductOption[], query: string): CatalogProductOption[] {
  return searchCatalogProductsShared(products, query);
}

/**
 * Parche a aplicar sobre un ProductItemDraft al elegir un producto del
 * catálogo — snapshot inicial (mismo criterio que Quotes, Fase 6D/6F):
 * estos valores quedan congelados en el estado del formulario desde este
 * instante, la selección NUNCA vuelve a re-consultar el catálogo. `model`
 * prefiere el campo real `model` del catálogo maestro (0030) y cae a `sku`
 * solo para productos que aún no lo tienen capturado — nunca se inventa
 * un valor. `description` usa el nombre comercial del producto. `unit` se
 * autocompleta desde product_catalog.unit cuando existe (queda "" si el
 * producto no lo tiene capturado) y sigue siendo editable; `color`/
 * `power`/`notes` conservan el comportamiento ya existente antes de esta
 * fase. `customerRequirements` NUNCA se autocompleta desde el catálogo —
 * nace vacío siempre, solo captura manual (pedido explícito del usuario).
 * NUNCA copia precio: Orders no maneja dinero.
 */
export function buildItemPatchFromCatalogProduct(
  product: CatalogProductOption,
  currentNotes: string
): Pick<
  ProductItemDraft,
  "catalogProductId" | "model" | "description" | "unit" | "power" | "color" | "notes"
> {
  return {
    catalogProductId: product.id,
    model: product.model || product.sku,
    description: product.name,
    unit: product.unit ?? "",
    power: product.power ?? "",
    color: product.color ?? "",
    notes: currentNotes || product.technicalNotes || "",
  };
}

export interface IncompatibleOrderItem {
  item: ProductItemDraft;
  product: CatalogProductOption;
}

/**
 * Líneas ya elegidas que dejarían de ser válidas si el Order cambiara a
 * `businessUnitId` — usado para bloquear el cambio de Business Unit
 * (Fase 6F §5) en vez de eliminar líneas en silencio. Solo mira líneas
 * con catalogProductId (líneas manuales nunca son "incompatibles").
 */
export function findIncompatibleItems(
  items: ProductItemDraft[],
  catalogProductsByIdMap: Map<string, CatalogProductOption>,
  businessUnitId: string
): IncompatibleOrderItem[] {
  return findIncompatibleItemsShared(items, catalogProductsByIdMap, businessUnitId);
}

export function catalogProductsById(products: CatalogProductOption[]): Map<string, CatalogProductOption> {
  return catalogProductsByIdShared(products);
}
