import "server-only";
import { salesOrderPdfAdapter } from "./sales-order";
import { requisitionPdfAdapter } from "./requisition";
import { purchaseOrderPdfAdapter } from "./purchase-order";
import { goodsReceiptPdfAdapter } from "./goods-receipt";
import { fulfillmentPdfAdapter } from "./fulfillment";
import { invoicePdfAdapter } from "./invoice";
import { commissionPdfAdapter } from "./commission";
import type { PdfDocumentAdapter } from "./types";

/**
 * Único punto de registro de los 7 tipos de documento — el endpoint
 * (src/app/api/pdf/[docType]/[id]/route.ts) resuelve el adapter aquí y
 * rechaza cualquier docType que no aparezca en este mapa (docType inválido
 * -> 404, nunca un adapter "por defecto" ni un fallback silencioso).
 */
export const PDF_DOCUMENT_ADAPTERS: Record<string, PdfDocumentAdapter> = {
  "sales-order": salesOrderPdfAdapter,
  requisition: requisitionPdfAdapter,
  "purchase-order": purchaseOrderPdfAdapter,
  "goods-receipt": goodsReceiptPdfAdapter,
  fulfillment: fulfillmentPdfAdapter,
  invoice: invoicePdfAdapter,
  commission: commissionPdfAdapter,
};

export type PdfDocType = keyof typeof PDF_DOCUMENT_ADAPTERS;
