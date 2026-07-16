import "server-only";

import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { issueFolioInTransaction } from "@/lib/folio/sequence";
import { resolveUnitPrice } from "@/lib/quotations/pricing";
import { computeApprovalTriggers } from "@/lib/quotations/approval-rules";

export class QuotationMutationError extends Error {}

export async function createQuotationDraft(input: {
  businessUnitId: string;
  customerId: string;
  sellerId: string;
  sellerCode: string;
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
    include: { items: true, seller: { select: { discountLimitPct: true } } },
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
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    if (quotation.status !== "DRAFT") {
      throw new QuotationMutationError(
        "Solo se pueden agregar productos a una cotización en borrador.",
      );
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

export async function removeQuotationItem(input: { quotationId: string; itemId: string }) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
    if (quotation.status !== "DRAFT") {
      throw new QuotationMutationError(
        "Solo se pueden quitar productos de una cotización en borrador.",
      );
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
