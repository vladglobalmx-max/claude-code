import "server-only";

import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { issueFolioInTransaction } from "@/lib/folio/sequence";
import { computeMarginPctFromSalePrice } from "@/lib/catalog/margin";
import { resolveUnitPrice } from "@/lib/quotations/pricing";

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

  const reasons: string[] = [];

  const belowMinMarginItems = quotation.items.filter((item) => {
    if (item.minMarginPctSnapshot == null || item.landedCostSnapshot == null) return false;
    const salePrice = item.unitPrice.toNumber() * (1 - item.discountPct.toNumber() / 100);
    if (salePrice <= 0) return true;
    const itemMarginPct = computeMarginPctFromSalePrice({
      landedCost: item.landedCostSnapshot.toNumber(),
      salePrice,
    });
    return itemMarginPct.lessThan(item.minMarginPctSnapshot.toNumber());
  });
  if (belowMinMarginItems.length > 0) {
    reasons.push(
      `Margen por debajo del mínimo en ${belowMinMarginItems.length} producto(s) — requiere autorización de Dirección General.`,
    );
  }

  const discountLimit = quotation.seller.discountLimitPct?.toNumber();
  const overLimitItems =
    discountLimit != null
      ? quotation.items.filter((item) => item.discountPct.toNumber() > discountLimit)
      : [];
  if (overLimitItems.length > 0) {
    reasons.push(
      `Descuento aplicado excede tu límite autorizado de ${discountLimit}% en ${overLimitItems.length} producto(s).`,
    );
  }

  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      total: total.toFixed(2),
      marginPct: marginPct != null ? marginPct.toFixed(2) : null,
      requiresApproval: reasons.length > 0,
      approvalReason: reasons.length > 0 ? reasons.join(" ") : null,
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

export async function submitQuotation(input: { quotationId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: input.quotationId },
      include: { items: true },
    });

    if (quotation.status !== "DRAFT") {
      throw new QuotationMutationError("Esta cotización ya fue enviada.");
    }
    if (quotation.items.length === 0) {
      throw new QuotationMutationError("Agrega al menos un producto antes de enviar.");
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

    return tx.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  });
}
