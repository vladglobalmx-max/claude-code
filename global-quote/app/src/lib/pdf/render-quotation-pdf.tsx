import "server-only";

import QRCode from "qrcode";
import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma/client";
import { QUOTATION_STATUS_LABELS } from "@/lib/quotations/status-labels";
import { displayFolio } from "@/lib/folio/format";

import { QuotationDocument, type QuotationPdfData } from "./quotation-document";

export class QuotationNotFoundForPdfError extends Error {}

export async function renderQuotationPdf(quotationId: string): Promise<Buffer> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      businessUnit: {
        select: { name: true, legalName: true, taxId: true, address: true, colorPrimary: true },
      },
      customer: { select: { legalName: true, tradeName: true, taxId: true } },
      seller: { select: { fullName: true, email: true } },
      items: {
        include: { product: { select: { internalSku: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!quotation) {
    throw new QuotationNotFoundForPdfError(`Cotización ${quotationId} no encontrada.`);
  }

  // El QR no apunta a una URL pública (todavía no existe un dominio de
  // verificación desplegado) — codifica los datos clave de la cotización
  // para que se pueda cotejar manualmente el folio/versión/total impresos
  // contra lo que dice el sistema, hasta que exista un endpoint público de
  // verificación (fuera de este alcance, ver README).
  const qrDataUrl = await QRCode.toDataURL(
    `GLOBAL QUOTE\nFolio: ${quotation.folio}\nVersión: ${quotation.currentVersion}\nTotal: ${quotation.total.toFixed(2)} ${quotation.currency}`,
    { margin: 1, width: 200 },
  );

  const data: QuotationPdfData = {
    folio: displayFolio(quotation.folio, quotation.currentVersion),
    version: quotation.currentVersion,
    status: quotation.status,
    statusLabel: QUOTATION_STATUS_LABELS[quotation.status],
    currency: quotation.currency,
    createdAt: quotation.createdAt,
    validUntil: quotation.validUntil,
    notes: quotation.notes,
    businessUnit: quotation.businessUnit,
    customer: quotation.customer,
    seller: quotation.seller,
    items: quotation.items.map((item) => ({
      sku: item.product.internalSku,
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice.toFixed(2),
      discountPct: item.discountPct.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    subtotal: quotation.subtotal.toFixed(2),
    discountTotal: quotation.discountTotal.toFixed(2),
    total: quotation.total.toFixed(2),
    qrDataUrl,
  };

  return renderToBuffer(<QuotationDocument data={data} />);
}
