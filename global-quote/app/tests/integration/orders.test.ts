import { afterAll, afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addQuotationItem,
  createQuotationDraft,
  markQuotationAccepted,
  markQuotationRejectedByClient,
  QuotationMutationError,
  submitQuotation,
} from "@/lib/quotations/mutations";
import { convertQuotationToOrder, OrderMutationError } from "@/lib/orders/mutations";
import { resolveSystemActorId } from "@/lib/followups/system-actor";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    const order = await prisma.order.findUnique({ where: { quotationId: id } });
    if (order) {
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.deleteMany({ where: { id: order.id } });
    }
    await prisma.quotationFollowup.deleteMany({ where: { quotationId: id } });
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: id } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.deleteMany({ where: { id } });
  }
});

// Este archivo es el unico, junto con folio-sequence.test.ts, que emite folios
// ORDER reales (año calendario actual) para GFB. Sin este reset,
// folio-sequence.test.ts asume que el consecutivo ORDER-GFB-<año actual>
// arranca en 0 y falla si este archivo corrió antes en el mismo proceso.
afterAll(async () => {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  await prisma.sequenceSettings.deleteMany({
    where: { businessUnitId: businessUnit.id, documentType: "ORDER", year: new Date().getFullYear() },
  });
});

async function fixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const seller = await prisma.user.findUniqueOrThrow({
    where: { email: "diego.ramirez@globalsuppliermty.com" },
  });
  const customerWithPriceList = await prisma.customer.findFirstOrThrow({
    where: { legalName: { contains: "Higiene del Norte" } },
  });
  const healthyProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-001" },
  });
  return { businessUnit, seller, customerWithPriceList, healthyProduct };
}

async function createSentQuotation() {
  const { businessUnit, seller, customerWithPriceList, healthyProduct } = await fixtures();
  const draft = await createQuotationDraft({
    businessUnitId: businessUnit.id,
    customerId: customerWithPriceList.id,
    sellerId: seller.id,
    sellerCode: seller.folioCode!,
    validUntil: null,
    notes: null,
  });
  createdQuotationIds.push(draft.id);

  await addQuotationItem({
    quotationId: draft.id,
    productId: healthyProduct.id,
    qty: 2,
    discountPct: 0,
    actorId: seller.id,
  });
  await submitQuotation({ quotationId: draft.id, actorId: seller.id });

  return { draft, seller };
}

describe("markQuotationAccepted / markQuotationRejectedByClient (docs/ARCHITECTURE.md §6.1, Módulo 12)", () => {
  it("moves a SENT quotation to ACCEPTED and records history", async () => {
    const { draft, seller } = await createSentQuotation();

    const accepted = await markQuotationAccepted({ quotationId: draft.id, actorId: seller.id });
    expect(accepted.status).toBe("ACCEPTED");

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: draft.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history[0]).toMatchObject({ fromStatus: "SENT", toStatus: "ACCEPTED", changedById: seller.id });
  });

  it("rejects accepting a quotation that isn't SENT", async () => {
    const { businessUnit, seller, customerWithPriceList } = await fixtures();
    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      validUntil: null,
      notes: null,
    });
    createdQuotationIds.push(draft.id);

    await expect(
      markQuotationAccepted({ quotationId: draft.id, actorId: seller.id }),
    ).rejects.toThrow(QuotationMutationError);
  });

  it("moves a SENT quotation to REJECTED with a reason and records history", async () => {
    const { draft, seller } = await createSentQuotation();

    const rejected = await markQuotationRejectedByClient({
      quotationId: draft.id,
      actorId: seller.id,
      reason: "Cliente decidió quedarse con proveedor actual.",
    });
    expect(rejected.status).toBe("REJECTED");

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: draft.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history[0]).toMatchObject({ fromStatus: "SENT", toStatus: "REJECTED", changedById: seller.id });
    expect(history[0].note).toContain("proveedor actual");
  });

  it("rejects rejecting a quotation that isn't SENT", async () => {
    const { draft, seller } = await createSentQuotation();
    await markQuotationAccepted({ quotationId: draft.id, actorId: seller.id });

    await expect(
      markQuotationRejectedByClient({ quotationId: draft.id, actorId: seller.id, reason: "tarde" }),
    ).rejects.toThrow(QuotationMutationError);
  });
});

describe("convertQuotationToOrder (docs/ARCHITECTURE.md §5.2/§6.1, Módulo 12)", () => {
  it("converts an ACCEPTED quotation into an order with its own PED- folio and frozen items", async () => {
    const { draft, seller } = await createSentQuotation();
    await markQuotationAccepted({ quotationId: draft.id, actorId: seller.id });

    const actorId = await resolveSystemActorId();
    const order = await convertQuotationToOrder({ quotationId: draft.id, actorId });

    const quotationBeforeConvert = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });

    expect(order.folio).toMatch(/^PED-GFB-\d{4}-\d+$/);
    expect(order.quotationId).toBe(draft.id);
    expect(order.total.toString()).toBe(quotationBeforeConvert.total.toString());
    expect(order.items).toHaveLength(1);
    expect(order.items[0].qty).toBe(2);

    const quotationAfter = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotationAfter.status).toBe("CONVERTED_TO_ORDER");

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: draft.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history[0]).toMatchObject({ fromStatus: "ACCEPTED", toStatus: "CONVERTED_TO_ORDER" });
  });

  it("rejects converting a quotation that isn't ACCEPTED", async () => {
    const { draft } = await createSentQuotation();
    const actorId = await resolveSystemActorId();

    await expect(
      convertQuotationToOrder({ quotationId: draft.id, actorId }),
    ).rejects.toThrow(OrderMutationError);
  });

  it("rejects converting the same quotation twice", async () => {
    const { draft, seller } = await createSentQuotation();
    await markQuotationAccepted({ quotationId: draft.id, actorId: seller.id });
    const actorId = await resolveSystemActorId();

    await convertQuotationToOrder({ quotationId: draft.id, actorId });

    await expect(
      convertQuotationToOrder({ quotationId: draft.id, actorId }),
    ).rejects.toThrow(OrderMutationError);
  });
});
