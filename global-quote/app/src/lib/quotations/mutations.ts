import "server-only";

import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { QuotationStatus } from "@/generated/prisma/enums";
import { issueFolioInTransaction } from "@/lib/folio/sequence";
import { resolveUnitPrice } from "@/lib/quotations/pricing";
import { computeApprovalTriggers } from "@/lib/quotations/approval-rules";
import { computeTaxTotal } from "@/lib/quotations/tax";

export class QuotationMutationError extends Error {}

/**
 * Estados en los que una cotización ya enviada se puede seguir editando
 * (docs/ARCHITECTURE.md §4.1, "Editar cotización ya aprobada" — Super
 * Admin/Administración, siempre con versión). `PENDING_APPROVAL` queda
 * fuera a propósito: no tiene sentido cambiar el contenido mientras una
 * excepción está a medio decidir. Los estados terminales (rechazada,
 * cancelada, vencida, convertida) tampoco son editables.
 */
const EDITABLE_AFTER_SEND_STATUSES: QuotationStatus[] = ["SENT", "ACCEPTED"];

/**
 * Congela el estado *anterior* al cambio en `quotation_versions` (Módulo 8,
 * docs/ARCHITECTURE.md §7.3) y sube `currentVersion`. Los montos se
 * convierten a string porque `Json` no serializa instancias de Decimal.
 */
async function freezeQuotationVersionSnapshot(
  tx: Prisma.TransactionClient,
  quotationId: string,
  actorId: string,
) {
  const quotation = await tx.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      items: {
        include: { product: { select: { internalSku: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await tx.quotationVersion.create({
    data: {
      quotationId,
      versionNumber: quotation.currentVersion,
      createdById: actorId,
      snapshot: {
        status: quotation.status,
        currency: quotation.currency,
        validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
        notes: quotation.notes,
        subtotal: quotation.subtotal.toFixed(2),
        discountTotal: quotation.discountTotal.toFixed(2),
        total: quotation.total.toFixed(2),
        taxTotal: quotation.taxTotal.toFixed(2),
        marginPct: quotation.marginPct ? quotation.marginPct.toFixed(2) : null,
        requiresApproval: quotation.requiresApproval,
        approvalReason: quotation.approvalReason,
        items: quotation.items.map((item) => ({
          productId: item.productId,
          productSku: item.product.internalSku,
          description: item.description,
          qty: item.qty,
          unitPrice: item.unitPrice.toFixed(2),
          discountPct: item.discountPct.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
      },
    },
  });

  await tx.quotation.update({
    where: { id: quotationId },
    data: { currentVersion: { increment: 1 } },
  });
}

export async function createQuotationDraft(input: {
  businessUnitId: string;
  customerId: string;
  sellerId: string;
  sellerCode: string;
  /** Tasa única elegida del catálogo `taxes` al crear (ver comentario en el esquema). Opcional: `null`/omitido = sin impuesto. */
  taxId?: string | null;
  validUntil: string | null;
  notes: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const { folio, shortFolio } = await issueFolioInTransaction(tx, {
      businessUnitId: input.businessUnitId,
      documentType: "QUOTATION",
      sellerCode: input.sellerCode,
    });

    const quotation = await tx.quotation.create({
      data: {
        folio,
        shortFolio,
        businessUnitId: input.businessUnitId,
        customerId: input.customerId,
        sellerId: input.sellerId,
        taxId: input.taxId,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        notes: input.notes,
        status: "DRAFT",
      },
    });

    await tx.quotationStatusHistory.create({
      data: {
        quotationId: quotation.id,
        fromStatus: null,
        toStatus: "DRAFT",
        changedById: input.sellerId,
      },
    });

    return quotation;
  });
}

async function recomputeQuotationTotals(tx: Prisma.TransactionClient, quotationId: string) {
  const quotation = await tx.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      items: true,
      seller: { select: { discountLimitPct: true } },
      tax: { select: { ratePct: true } },
    },
  });

  const subtotal = quotation.items.reduce(
    (sum, item) => sum.plus(new Decimal(item.qty).times(item.unitPrice.toString())),
    new Decimal(0),
  );
  const total = quotation.items.reduce(
    (sum, item) => sum.plus(item.lineTotal.toString()),
    new Decimal(0),
  );
  const discountTotal = subtotal.minus(total);
  const totalLandedCost = quotation.items.reduce(
    (sum, item) =>
      sum.plus(new Decimal(item.qty).times(item.landedCostSnapshot?.toString() ?? 0)),
    new Decimal(0),
  );
  const marginPct = total.greaterThan(0)
    ? total.minus(totalLandedCost).dividedBy(total).times(100)
    : null;
  const taxTotal = computeTaxTotal(total, quotation.tax?.ratePct ?? null);

  const triggers = computeApprovalTriggers({
    items: quotation.items,
    discountLimitPct: quotation.seller.discountLimitPct,
    total,
    validUntil: quotation.validUntil,
    createdAt: quotation.createdAt,
  });

  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      total: total.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      marginPct: marginPct != null ? marginPct.toFixed(2) : null,
      requiresApproval: triggers.length > 0,
      approvalReason: triggers.length > 0 ? triggers.map((t) => t.message).join(" ") : null,
    },
  });
}

export async function addQuotationItem(input: {
  quotationId: string;
  productId: string;
  qty: number;
  discountPct: number;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    const isEditableAfterSend = EDITABLE_AFTER_SEND_STATUSES.includes(quotation.status);
    if (quotation.status !== "DRAFT" && !isEditableAfterSend) {
      throw new QuotationMutationError(
        "No se pueden agregar productos a una cotización en este estado.",
      );
    }
    if (isEditableAfterSend) {
      await freezeQuotationVersionSnapshot(tx, input.quotationId, input.actorId);
    }

    const unitPrice = await resolveUnitPrice({
      customerId: quotation.customerId,
      productId: input.productId,
    });
    if (unitPrice == null) {
      throw new QuotationMutationError(
        "Este producto no tiene un precio vigente para este cliente — no se puede cotizar (docs/ARCHITECTURE.md §8.2).",
      );
    }

    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      include: { costs: { where: { effectiveTo: null }, take: 1 } },
    });
    const cost = product.costs[0];

    const lineTotal = new Decimal(input.qty)
      .times(unitPrice)
      .times(new Decimal(1).minus(new Decimal(input.discountPct).dividedBy(100)));

    await tx.quotationItem.create({
      data: {
        quotationId: input.quotationId,
        productId: input.productId,
        description: product.name,
        qty: input.qty,
        unitPrice,
        discountPct: input.discountPct,
        lineTotal: lineTotal.toFixed(2),
        landedCostSnapshot: cost?.landedCost ?? null,
        minMarginPctSnapshot: cost?.minMarginPct ?? null,
      },
    });

    await recomputeQuotationTotals(tx, input.quotationId);

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}

export async function removeQuotationItem(input: {
  quotationId: string;
  itemId: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    const isEditableAfterSend = EDITABLE_AFTER_SEND_STATUSES.includes(quotation.status);
    if (quotation.status !== "DRAFT" && !isEditableAfterSend) {
      throw new QuotationMutationError(
        "No se pueden quitar productos de una cotización en este estado.",
      );
    }
    if (isEditableAfterSend) {
      await freezeQuotationVersionSnapshot(tx, input.quotationId, input.actorId);
    }

    await tx.quotationItem.delete({ where: { id: input.itemId } });
    await recomputeQuotationTotals(tx, input.quotationId);

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}

export async function submitQuotation(input: {
  quotationId: string;
  actorId: string;
  justification?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: input.quotationId },
      include: { items: true, seller: { select: { discountLimitPct: true } } },
    });

    if (quotation.status !== "DRAFT") {
      throw new QuotationMutationError("Esta cotización ya fue enviada.");
    }
    if (quotation.items.length === 0) {
      throw new QuotationMutationError("Agrega al menos un producto antes de enviar.");
    }

    if (quotation.requiresApproval && !input.justification?.trim()) {
      throw new QuotationMutationError(
        "Esta cotización requiere autorización — explica el motivo antes de enviarla.",
      );
    }

    const nextStatus = quotation.requiresApproval ? "PENDING_APPROVAL" : "SENT";

    await tx.quotation.update({ where: { id: input.quotationId }, data: { status: nextStatus } });
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: input.quotationId,
        fromStatus: "DRAFT",
        toStatus: nextStatus,
        changedById: input.actorId,
        note: quotation.requiresApproval ? quotation.approvalReason : null,
      },
    });

    if (quotation.requiresApproval) {
      const triggers = computeApprovalTriggers({
        items: quotation.items,
        discountLimitPct: quotation.seller.discountLimitPct,
        total: quotation.total,
        validUntil: quotation.validUntil,
        createdAt: quotation.createdAt,
      });
      const primary = triggers[0];
      await tx.quotationApproval.create({
        data: {
          quotationId: input.quotationId,
          ruleType: primary.ruleType,
          reason: quotation.approvalReason ?? primary.message,
          requestedById: input.actorId,
          justification: input.justification!.trim(),
          marginPctBefore: quotation.marginPct,
        },
      });
    }

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}

/**
 * Registra la decisión real del cliente sobre una cotización enviada
 * (docs/ARCHITECTURE.md §6.1: `Enviada -> ... -> Aceptada` o `Rechazada por
 * cliente`). Esta app no tiene portal de cliente, así que quien la
 * atiende (vendedor/Administración) captura lo que el cliente decidió por
 * el canal que haya sido (llamada, correo, WhatsApp) — no es una firma
 * electrónica ni una confirmación automática (eso es Fase 3).
 */
export async function markQuotationAccepted(input: { quotationId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    if (quotation.status !== "SENT") {
      throw new QuotationMutationError("Solo se puede aceptar una cotización enviada.");
    }

    await tx.quotation.update({ where: { id: input.quotationId }, data: { status: "ACCEPTED" } });
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: input.quotationId,
        fromStatus: "SENT",
        toStatus: "ACCEPTED",
        changedById: input.actorId,
      },
    });

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}

export async function markQuotationRejectedByClient(input: {
  quotationId: string;
  actorId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    if (quotation.status !== "SENT") {
      throw new QuotationMutationError("Solo se puede rechazar una cotización enviada.");
    }

    await tx.quotation.update({ where: { id: input.quotationId }, data: { status: "REJECTED" } });
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: input.quotationId,
        fromStatus: "SENT",
        toStatus: "REJECTED",
        changedById: input.actorId,
        note: input.reason,
      },
    });

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}
