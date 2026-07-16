import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { addQuotationItem, createQuotationDraft, submitQuotation } from "@/lib/quotations/mutations";
import { addFollowup, expireOverdueQuotations, FollowupMutationError } from "@/lib/followups/mutations";
import { resolveSystemActorId } from "@/lib/followups/system-actor";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    await prisma.quotationFollowup.deleteMany({ where: { quotationId: id } });
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: id } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.deleteMany({ where: { id } });
  }
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

async function createSentQuotation(validUntil: string | null) {
  const { businessUnit, seller, customerWithPriceList, healthyProduct } = await fixtures();
  const draft = await createQuotationDraft({
    businessUnitId: businessUnit.id,
    customerId: customerWithPriceList.id,
    sellerId: seller.id,
    sellerCode: seller.folioCode!,
    validUntil,
    notes: null,
  });
  createdQuotationIds.push(draft.id);

  await addQuotationItem({
    quotationId: draft.id,
    productId: healthyProduct.id,
    qty: 1,
    discountPct: 0,
    actorId: seller.id,
  });
  await submitQuotation({ quotationId: draft.id, actorId: seller.id });

  return { draft, seller };
}

describe("addFollowup (docs/ARCHITECTURE.md §5.2, Módulo 11)", () => {
  it("logs a follow-up on a sent quotation", async () => {
    const { draft, seller } = await createSentQuotation(null);

    const followup = await addFollowup({
      quotationId: draft.id,
      ownerId: seller.id,
      contactMethod: "PHONE",
      nextFollowupAt: new Date("2026-08-01T00:00:00.000Z"),
      closeProbabilityPct: 60,
      competitor: "Competidor X",
      objection: "Precio",
      comments: "Llamó preguntando por descuento adicional.",
    });

    expect(followup.contactMethod).toBe("PHONE");
    expect(followup.closeProbabilityPct?.toString()).toBe("60");
    expect(followup.ownerId).toBe(seller.id);
  });

  it("rejects logging a follow-up on a draft quotation", async () => {
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
      addFollowup({
        quotationId: draft.id,
        ownerId: seller.id,
        contactMethod: "EMAIL",
        nextFollowupAt: null,
        closeProbabilityPct: null,
        competitor: null,
        objection: null,
        comments: null,
      }),
    ).rejects.toThrow(FollowupMutationError);
  });
});

describe("expireOverdueQuotations (docs/ARCHITECTURE.md §6.1, Módulo 11)", () => {
  it("expires a SENT quotation past its validUntil, but leaves others untouched", async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const { draft: overdueDraft } = await createSentQuotation("2020-01-01T00:00:00.000Z");
    const { draft: healthyDraft } = await createSentQuotation(soon);
    const { draft: noValidUntilDraft } = await createSentQuotation(null);

    const systemActorId = await resolveSystemActorId();
    const expiredIds = await expireOverdueQuotations(new Date(), systemActorId);

    expect(expiredIds).toContain(overdueDraft.id);
    expect(expiredIds).not.toContain(healthyDraft.id);
    expect(expiredIds).not.toContain(noValidUntilDraft.id);

    const overdueAfter = await prisma.quotation.findUniqueOrThrow({ where: { id: overdueDraft.id } });
    expect(overdueAfter.status).toBe("EXPIRED");

    const healthyAfter = await prisma.quotation.findUniqueOrThrow({ where: { id: healthyDraft.id } });
    expect(healthyAfter.status).toBe("SENT");

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: overdueDraft.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history[0].toStatus).toBe("EXPIRED");
    expect(history[0].changedById).toBe(systemActorId);
  });

  it("is idempotent — running it twice does not re-expire or duplicate history", async () => {
    const { draft } = await createSentQuotation("2020-01-01T00:00:00.000Z");
    const systemActorId = await resolveSystemActorId();

    const firstRun = await expireOverdueQuotations(new Date(), systemActorId);
    expect(firstRun).toContain(draft.id);

    const secondRun = await expireOverdueQuotations(new Date(), systemActorId);
    expect(secondRun).not.toContain(draft.id);

    const history = await prisma.quotationStatusHistory.findMany({ where: { quotationId: draft.id } });
    expect(history.filter((h) => h.toStatus === "EXPIRED")).toHaveLength(1);
  });
});
