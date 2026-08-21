import type { QuoteCurrency } from "@/types/domain";

/**
 * Producto del catálogo administrable, con sus relaciones de Business Unit
 * ya resueltas (ver product_business_units, 0019_core_product_catalog_pricing.sql)
 * — para filtrar el selector de productos por la Business Unit elegida en
 * la Quote. `businessUnitIds` vacío = compartido con todas las Business
 * Units de la organización.
 */
export interface QuoteCatalogProductOption {
  id: string;
  category: string;
  sku: string;
  name: string;
  defaultPriceMxn: number | null;
  defaultPriceUsd: number | null;
  businessUnitIds: string[];
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
    items: [emptyQuoteItem()],
  };
}
