import type { QuoteCurrency } from "@/types/domain";

/**
 * Producto del catálogo administrable, con sus relaciones de Business Unit
 * ya resueltas (ver product_business_units, 0019_core_product_catalog_pricing.sql)
 * — para filtrar el selector de productos por la Business Unit elegida en
 * la Quote. `businessUnitIds` vacío = compartido con todas las Business
 * Units de la organización.
 *
 * Campos de Fase 6D (Catálogo Maestro → Quote Builder, sobre 0030): `model`/
 * `brand` reutilizan las columnas reales del Catálogo Maestro (nunca se
 * inventan); `productTypeName` es solo metadata para buscar/filtrar en el
 * selector — nunca se copia a quote_items (ver DECISIÓN Product Type,
 * Fase 6D). `imagePreviewUrl` ya viene resuelta a URL firmada desde el
 * servidor (mismo patrón que CatalogProductOption de Pedidos) — el Quote
 * Builder nunca llama a Storage directamente.
 */
export interface QuoteCatalogProductOption {
  id: string;
  category: string;
  sku: string;
  name: string;
  model: string | null;
  brand: string | null;
  unit: string | null;
  productTypeName: string | null;
  defaultPriceMxn: number | null;
  defaultPriceUsd: number | null;
  businessUnitIds: string[];
  imagePath: string | null;
  imagePreviewUrl: string | null;
}

export interface QuoteItemDraft {
  key: string;
  catalogProductId: string | null;
  model: string;
  description: string;
  quantity: number;
  /** String de control del input — se parsea a número solo al construir el payload, nunca antes. */
  unitPrice: string;
  lineDiscountPercent: string;
  /**
   * Datos operativos por línea (0028/0031_quote_catalog_operational_fields.sql).
   * `unit` se autocompleta desde product_catalog.unit al elegir un producto
   * del catálogo (buildItemPatchFromCatalogProduct) pero sigue siendo
   * editable; `customer_requirements` nace vacío siempre — nunca se infiere
   * del catálogo.
   */
  unit: string;
  customerRequirements: string;
}

export function emptyQuoteItem(): QuoteItemDraft {
  return {
    key: crypto.randomUUID(),
    catalogProductId: null,
    model: "",
    description: "",
    quantity: 1,
    unitPrice: "",
    lineDiscountPercent: "0",
    unit: "",
    customerRequirements: "",
  };
}

export interface QuoteFormState {
  businessUnitId: string;
  salespersonId: string;
  customerId: string;
  currency: QuoteCurrency;
  taxRate: string;
  globalDiscountPercent: string;
  validUntil: string;
  notes: string;
  paymentTerms: string;
  deliveryTime: string;
  customerNotes: string;
  /** Garantía (0028/0031) — mismo tratamiento que paymentTerms/deliveryTime. */
  warranty: string;
  items: QuoteItemDraft[];
}

export function emptyQuoteForm({
  businessUnitId,
  salespersonId,
  validUntil,
}: {
  businessUnitId: string;
  salespersonId: string;
  validUntil: string;
}): QuoteFormState {
  return {
    businessUnitId,
    salespersonId,
    customerId: "",
    currency: "MXN",
    taxRate: "16",
    globalDiscountPercent: "0",
    validUntil,
    notes: "",
    paymentTerms: "",
    deliveryTime: "",
    customerNotes: "",
    warranty: "",
    items: [emptyQuoteItem()],
  };
}
