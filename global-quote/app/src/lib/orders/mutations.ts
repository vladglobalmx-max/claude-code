import "server-only";

import { prisma } from "@/lib/prisma/client";
import { issueFolioInTransaction } from "@/lib/folio/sequence";

export class OrderMutationError extends Error {}

/**
 * Conversión de una cotización aceptada en pedido, con un clic
 * (docs/ARCHITECTURE.md §5.2/§6.1/§10, Módulo 12). El folio de pedido usa
 * su propia serie independiente (`PED-{LINEA}-{AÑO}-{CONSECUTIVO}`, ya
 * construida en el Módulo 5 — `documentType: "ORDER"`), emitido dentro de
 * la MISMA transacción que crea el pedido, igual que el folio de la
 * cotización original. `order_items` es una copia congelada de
 * `quotation_items` al momento de la conversión, no una referencia viva:
 * `CONVERTED_TO_ORDER` es un estado terminal para la cotización, así que
 * no hay riesgo de que sus partidas cambien después, pero el pedido nunca
 * debería depender de leer la cotización para saber qué se vendió.
 */
export async function convertQuotationToOrder(input: { quotationId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: input.quotationId },
      include: { items: true, seller: { select: { folioCode: true } }, order: true },
    });

    if (quotation.status !== "ACCEPTED") {
      throw new OrderMutationError("Solo se puede convertir en pedido una cotización aceptada.");
    }
    if (quotation.order) {
      throw new OrderMutationError("Esta cotización ya fue convertida en pedido.");
    }

    const { folio } = await issueFolioInTransaction(tx, {
      businessUnitId: quotation.businessUnitId,
      documentType: "ORDER",
      sellerCode: quotation.seller.folioCode ?? "NA",
    });

    const order = await tx.order.create({
      data: {
        folio,
        quotationId: quotation.id,
        businessUnitId: quotation.businessUnitId,
        customerId: quotation.customerId,
        sellerId: quotation.sellerId,
        currency: quotation.currency,
        subtotal: quotation.subtotal,
        discountTotal: quotation.discountTotal,
        total: quotation.total,
        taxId: quotation.taxId,
        taxTotal: quotation.taxTotal,
      },
    });

    await tx.orderItem.createMany({
      data: quotation.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountPct: item.discountPct,
        lineTotal: item.lineTotal,
        sortOrder: item.sortOrder,
      })),
    });

    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "CONVERTED_TO_ORDER" },
    });
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: quotation.id,
        fromStatus: "ACCEPTED",
        toStatus: "CONVERTED_TO_ORDER",
        changedById: input.actorId,
        note: `Convertida al pedido ${folio}.`,
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  });
}
