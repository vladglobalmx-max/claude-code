import type { SalesOrderCurrency } from "@/types/domain";

/**
 * Producto del catálogo administrable, versión mínima para el selector de
 * líneas de Sales Orders — a diferencia de QuoteCatalogProductOption
 * (Quotes), sin imágenes ni filtrado por Business Unit (Sales Orders no
 * tiene ese concepto, ver 0067_sales_orders_mvp.sql).
 */
export interface SalesOrderCatalogProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  defaultPriceMxn: number | null;
  defaultPriceUsd: number | null;
}

export interface SalesOrderItemDraft {
  key: string;
  catalogProductId: string | null;
  skuSnapshot: string;
  descriptionSnapshot: string;
  uomSnapshot: string;
  quantity: number;
  /** String de control del input — se parsea a número solo al construir el payload, nunca antes. */
  unitPrice: string;
  discount: string;
  tax: string;
}

export function emptySalesOrderItem(): SalesOrderItemDraft {
  return {
    key: crypto.randomUUID(),
    catalogProductId: null,
    skuSnapshot: "",
    descriptionSnapshot: "",
    uomSnapshot: "",
    quantity: 1,
    unitPrice: "",
    discount: "0",
    tax: "0",
  };
}

export interface SalesOrderFormState {
  customerId: string;
  salespersonId: string;
  currency: SalesOrderCurrency;
  exchangeRate: string;
  paymentTerms: string;
  requestedDeliveryDate: string;
  commercialNotes: string;
  internalNotes: string;
  items: SalesOrderItemDraft[];
}

export function emptySalesOrderForm({ salespersonId }: { salespersonId: string }): SalesOrderFormState {
  return {
    customerId: "",
    salespersonId,
    currency: "MXN",
    exchangeRate: "",
    paymentTerms: "",
    requestedDeliveryDate: "",
    commercialNotes: "",
    internalNotes: "",
    items: [emptySalesOrderItem()],
  };
}
