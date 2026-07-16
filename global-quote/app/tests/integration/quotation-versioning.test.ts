import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addQuotationItem,
  createQuotationDraft,
  QuotationMutationError,
  removeQuotationItem,
  submitQuotation,
} from "@/lib/quotations/mutations";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    // quotation_versions y quotation_approvals se van con el CASCADE del
    // borrado de la cotización.
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
  const staleMarginProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-004" },
  });
  return { businessUnit, seller, customerWithPriceList, healthyProduct, staleMarginProduct };
}

async function createSentDraftWithOneItem() {
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

  return { draft, seller, healthyProduct };
}

describe("versioning on post-send edits (docs/ARCHITECTURE.md §7.3, Módulo 8)", () => {
  it("freezes the pre-edit state as version 1 and bumps currentVersion to 2 when adding an item", async () => {
    const { draft, seller, healthyProduct } = await createSentDraftWithOneItem();

    const beforeTotal = (
      await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } })
    ).total.toFixed(2);

    const updated = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
      actorId: seller.id,
    });

    expect(updated.currentVersion).toBe(2);
    expect(updated.status).toBe("SENT");

    const version1 = await prisma.quotationVersion.findUniqueOrThrow({
      where: { quotationId_versionNumber: { quotationId: draft.id, versionNumber: 1 } },
    });
    expect(version1.createdById).toBe(seller.id);
    expect(version1.snapshot).toMatchObject({ status: "SENT", total: beforeTotal });
    const snapshot = version1.snapshot as { items: unknown[] };
    expect(snapshot.items).toHaveLength(1);
  });

  it("freezes a version when removing an item too, capturing the pre-removal item list", async () => {
    const { draft, seller, healthyProduct } = await createSentDraftWithOneItem();
    const secondItem = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
      actorId: seller.id,
    });
    // Ahora estamos en la version 2 (viva), con 2 partidas.
    const items = await prisma.quotationItem.findMany({ where: { quotationId: draft.id } });
    expect(items).toHaveLength(2);
    expect(secondItem.currentVersion).toBe(2);

    const afterRemove = await removeQuotationItem({
      quotationId: draft.id,
      itemId: items[0].id,
      actorId: seller.id,
    });

    expect(afterRemove.currentVersion).toBe(3);
    const version2 = await prisma.quotationVersion.findUniqueOrThrow({
      where: { quotationId_versionNumber: { quotationId: draft.id, versionNumber: 2 } },
    });
    const snapshot = version2.snapshot as { items: unknown[] };
    expect(snapshot.items).toHaveLength(2); // el estado ANTERIOR al remove, con ambas partidas
  });

  it("keeps every past version queryable — editing twice creates two distinct, immutable snapshots", async () => {
    const { draft, seller, healthyProduct } = await createSentDraftWithOneItem();

    await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
      actorId: seller.id,
    });
    await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
      actorId: seller.id,
    });

    const versions = await prisma.quotationVersion.findMany({
      where: { quotationId: draft.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);

    const final = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.currentVersion).toBe(3);
  });

  it("allows editing an ACCEPTED quotation the same way as SENT", async () => {
    const { draft, seller, healthyProduct } = await createSentDraftWithOneItem();
    await prisma.quotation.update({ where: { id: draft.id }, data: { status: "ACCEPTED" } });

    const updated = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
      actorId: seller.id,
    });

    expect(updated.status).toBe("ACCEPTED");
    expect(updated.currentVersion).toBe(2);
  });

  it.each(["PENDING_APPROVAL", "REJECTED", "CANCELLED", "EXPIRED", "CONVERTED_TO_ORDER"] as const)(
    "rejects editing a quotation in %s status",
    async (status) => {
      const { draft, seller, healthyProduct } = await createSentDraftWithOneItem();
      await prisma.quotation.update({ where: { id: draft.id }, data: { status } });

      await expect(
        addQuotationItem({
          quotationId: draft.id,
          productId: healthyProduct.id,
          qty: 1,
          discountPct: 0,
          actorId: seller.id,
        }),
      ).rejects.toThrow(QuotationMutationError);

      const untouched = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
      expect(untouched.currentVersion).toBe(1);
    },
  );
});
