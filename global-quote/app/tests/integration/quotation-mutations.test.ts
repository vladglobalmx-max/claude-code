import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addQuotationItem,
  createQuotationDraft,
  QuotationMutationError,
  removeQuotationItem,
  submitQuotation,
} from "@/lib/quotations/mutations";
import { resolveUnitPrice } from "@/lib/quotations/pricing";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
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
  const prospectWithoutPriceList = await prisma.customer.findFirstOrThrow({
    where: { legalName: { contains: "RapiExpress" } },
  });
  const healthyProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-001" },
  });
  const staleMarginProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-004" },
  });
  return {
    businessUnit,
    seller,
    customerWithPriceList,
    prospectWithoutPriceList,
    healthyProduct,
    staleMarginProduct,
  };
}

describe("resolveUnitPrice", () => {
  it("resolves the customer's assigned price list when it has an item for the product", async () => {
    const { customerWithPriceList, healthyProduct } = await fixtures();
    const price = await resolveUnitPrice({
      customerId: customerWithPriceList.id,
      productId: healthyProduct.id,
    });
    expect(price).toBe(46.15);
  });

  it("falls back to the business unit's default price list when the customer has none", async () => {
    const { prospectWithoutPriceList, healthyProduct } = await fixtures();
    const price = await resolveUnitPrice({
      customerId: prospectWithoutPriceList.id,
      productId: healthyProduct.id,
    });
    expect(price).toBe(46.15);
  });
});

describe("createQuotationDraft (docs/ARCHITECTURE.md §7.4)", () => {
  it("issues a real folio atomically with the draft", async () => {
    const { businessUnit, seller, customerWithPriceList } = await fixtures();

    const quotation = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      validUntil: null,
      notes: null,
    });
    createdQuotationIds.push(quotation.id);

    expect(quotation.folio).toMatch(/^GFB-\d{4}-\d{2}-\d{4}-DR$/);
    expect(quotation.status).toBe("DRAFT");

    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: quotation.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe("DRAFT");
  });
});

describe("addQuotationItem / removeQuotationItem", () => {
  it("computes line total and recomputes quotation totals without requiring approval for a healthy margin", async () => {
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

    const updated = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 2,
      discountPct: 0,
    });

    expect(updated.total.toNumber()).toBe(92.3); // 2 * 46.15
    expect(updated.requiresApproval).toBe(false);
    expect(updated.marginPct?.toNumber()).toBeCloseTo(34.99, 1);
  });

  it("flags requiresApproval when the item's margin is already below its minimum", async () => {
    const { businessUnit, seller, customerWithPriceList, staleMarginProduct } = await fixtures();
    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      validUntil: null,
      notes: null,
    });
    createdQuotationIds.push(draft.id);

    const updated = await addQuotationItem({
      quotationId: draft.id,
      productId: staleMarginProduct.id, // GFB-ENJ-004: precio ya por debajo del margen minimo
      qty: 1,
      discountPct: 0,
    });

    expect(updated.requiresApproval).toBe(true);
    expect(updated.approvalReason).toContain("Margen por debajo del mínimo");
  });

  it("flags requiresApproval when the discount exceeds the seller's limit", async () => {
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

    // Diego (VENDEDOR demo) tiene discountLimitPct = 5 en el seed.
    const updated = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 15,
    });

    expect(updated.requiresApproval).toBe(true);
    expect(updated.approvalReason).toContain("excede tu límite autorizado de 5%");
  });

  it("recomputes totals after removing an item", async () => {
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

    const afterAdd = await addQuotationItem({
      quotationId: draft.id,
      productId: healthyProduct.id,
      qty: 1,
      discountPct: 0,
    });
    const item = await prisma.quotationItem.findFirstOrThrow({ where: { quotationId: draft.id } });

    const afterRemove = await removeQuotationItem({ quotationId: draft.id, itemId: item.id });

    expect(afterAdd.total.toNumber()).toBeGreaterThan(0);
    expect(afterRemove.total.toNumber()).toBe(0);
    expect(afterRemove.marginPct).toBeNull();
  });

  it("rejects adding items to a quotation that is not a draft", async () => {
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
      qty: 1,
      discountPct: 0,
    });
    await submitQuotation({ quotationId: draft.id, actorId: seller.id });

    await expect(
      addQuotationItem({ quotationId: draft.id, productId: healthyProduct.id, qty: 1, discountPct: 0 }),
    ).rejects.toThrow(QuotationMutationError);
  });
});

describe("submitQuotation", () => {
  it("transitions a healthy quotation straight to SENT", async () => {
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
      qty: 1,
      discountPct: 0,
    });
    const sent = await submitQuotation({ quotationId: draft.id, actorId: seller.id });

    expect(sent.status).toBe("SENT");
    const history = await prisma.quotationStatusHistory.findMany({
      where: { quotationId: draft.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual(["DRAFT", "SENT"]);
  });

  it("routes a flagged quotation to PENDING_APPROVAL instead of SENT", async () => {
    const { businessUnit, seller, customerWithPriceList, staleMarginProduct } = await fixtures();
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
      productId: staleMarginProduct.id,
      qty: 1,
      discountPct: 0,
    });
    const result = await submitQuotation({ quotationId: draft.id, actorId: seller.id });

    expect(result.status).toBe("PENDING_APPROVAL");
  });

  it("rejects submitting a quotation with no items", async () => {
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

    await expect(submitQuotation({ quotationId: draft.id, actorId: seller.id })).rejects.toThrow(
      QuotationMutationError,
    );
  });
});
