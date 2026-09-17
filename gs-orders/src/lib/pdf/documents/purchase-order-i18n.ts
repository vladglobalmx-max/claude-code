import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import type { PurchaseOrderStatus } from "@/types/domain";

/**
 * THÖREN — Orden de Compra Directa (0081). Diccionario pequeño, exclusivo
 * del PDF de Purchase Order — mismo criterio que
 * src/app/(print)/pedidos/[id]/pdf/provider-i18n.ts (0063): NUNCA un motor
 * de i18n de toda la app, y NUNCA traduce datos reales capturados por el
 * usuario (nombre de producto, descripción libre, modelo, notas). El idioma
 * viene de purchase_orders.document_language (snapshot al crear la OC) —
 * este archivo nunca decide el idioma por sí mismo.
 */
export type PurchaseOrderDocumentLanguage = "es" | "en";

const LABELS = {
  documentType: { es: "Orden de Compra", en: "Purchase Order" },
  supplier: { es: "Proveedor", en: "Supplier" },
  date: { es: "Fecha", en: "Date" },
  requiredDate: { es: "Fecha requerida", en: "Required Date" },
  quantity: { es: "Cantidad", en: "Quantity" },
  unit: { es: "Unidad", en: "Unit" },
  description: { es: "Descripción", en: "Description" },
  unitPrice: { es: "Precio Unitario", en: "Unit Price" },
  amount: { es: "Importe", en: "Amount" },
  subtotal: { es: "Subtotal", en: "Subtotal" },
  taxes: { es: "Impuestos", en: "Taxes" },
  total: { es: "Total", en: "Total" },
  paymentTerms: { es: "Condiciones de Pago", en: "Payment Terms" },
  shipTo: { es: "Entregar en", en: "Ship To" },
  notes: { es: "Notas", en: "Notes" },
  reference: { es: "Referencia/modelo proveedor", en: "Supplier reference/model" },
  /** THÖREN — fix de cierre 0081: título de la sección "Datos relacionados" del layout compartido (document-pdf.tsx). */
  relatedData: { es: "Datos relacionados", en: "Related Information" },
  /** THÖREN — fix de cierre 0081: prefijo "Generado el <fecha>" del pie de página del layout compartido. */
  generatedOn: { es: "Generado el", en: "Generated on" },
} as const;

export type PurchaseOrderLabelKey = keyof typeof LABELS;

/** Exclusivamente para pruebas — permite iterar todas las etiquetas fijas del documento sin duplicar la lista. */
export const LABELS_FOR_TESTING = LABELS;

/** Etiqueta fija del documento — nunca un dato real (proveedor/SKU/descripción/notas libres). */
export function purchaseOrderLabel(key: PurchaseOrderLabelKey, language: PurchaseOrderDocumentLanguage): string {
  return LABELS[key][language];
}

const STATUS_LABELS_EN: Record<PurchaseOrderStatus, string> = {
  borrador: "Draft",
  ordenada: "Ordered",
  confirmada: "Confirmed",
  en_transito: "In transit",
  recibida_parcial: "Partially received",
  recibida: "Received",
  cancelada: "Cancelled",
};

/** Estado de la Purchase Order (badge) — nunca traduce nada más allá de este enum fijo de 7 valores. */
export function translatePurchaseOrderStatus(
  status: PurchaseOrderStatus,
  language: PurchaseOrderDocumentLanguage,
  spanishLabel: string
): string {
  return language === "en" ? STATUS_LABELS_EN[status] : spanishLabel;
}

/**
 * Fecha del documento — mismo criterio que translateDate en provider-i18n.ts
 * (0063): en español usa el formato ya existente (formatDate, nombre de mes
 * en español), en inglés usa el mismo formato "d MMMM yyyy" con locale
 * enUS para que un documento en inglés no muestre nombres de mes en
 * español (ej. "enero").
 */
export function translatePurchaseOrderDate(dateStr: string, language: PurchaseOrderDocumentLanguage, spanishFormatted: string): string {
  if (language !== "en") return spanishFormatted;
  return format(parseISO(dateStr), "MMMM d, yyyy", { locale: enUS });
}

/**
 * Fecha/hora de "Generado el" (footer, sello de generación) — mismo
 * criterio que translatePurchaseOrderDate: en español usa el formato ya
 * existente (formatDateTime), en inglés usa el mismo patrón con locale
 * enUS para que un documento en inglés nunca muestre un nombre de mes en
 * español.
 */
export function translatePurchaseOrderDateTime(
  isoDateTime: string,
  language: PurchaseOrderDocumentLanguage,
  spanishFormatted: string
): string {
  if (language !== "en") return spanishFormatted;
  return format(parseISO(isoDateTime), "MMM d, yyyy, HH:mm", { locale: enUS });
}
