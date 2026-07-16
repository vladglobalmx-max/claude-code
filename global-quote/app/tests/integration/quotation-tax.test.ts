import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addQuotationItem,
  createQuotationDraft,
  markQuotationAccepted,
  submitQuotation,
} from "@/lib/quotations/mutations";
import { convertQuotationToOrder } from "@/lib/orders/mutations";
import { resolveSystemActorId } from "@/lib/followups/system-actor";

const createdQuotationIds: string[] = [];
const createdTaxIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    const order = await prisma.order.findUnique({ where: { quotationId: id } });
    if (order) {
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.deleteMany({ where: { id: order.id } });
    }
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: id } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.deleteMany({ where: { id } });
  }
  while (createdTaxIds.length > 0) {
    await prisma.tax.deleteMany({ where: { id: createdTaxIds.pop()! } });
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
  const tax = await prisma.tax.create({
    data: { code: `IVA-TEST-${Date.now()}`, name: "IVA", ratePct: 16, active: true },
  });
  createdTaxIds.push(tax.id);
  return { businessUnit, seller, customerWithPriceList, healthyProduct, tax };
}

describe("IVA por cotización (tasa única elegida al crear)", () => {
  it("computes taxTotal at 16% of the pre-tax total when a tax is chosen", async () => {
    const { businessUnit, seller, customerWithPriceList, healthyProduct, tax } = await fixtures();

    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      taxId: tax.id,
      validUntil: null,
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

    const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotation.taxId).toBe(tax.id);
    expect(quotation.taxTotal.toString()).toBe(
      quotation.total.times(0.16).toFixed(2),
    );
  });

  it("defaults to no tax (taxTotal 0) when none is chosen", async () => {
    const { businessUnit, seller, customerWithPriceList, healthyProduct } = await fixtures();

    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      taxId: null,
      validUntil: null,
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

    const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(quotation.taxId).toBeNull();
    expect(quotation.taxTotal.toNumber()).toBe(0);
  });

  it("carries taxId and taxTotal into the order when converted", async () => {
    const { businessUnit, seller, customerWithPriceList, healthyProduct, tax } = await fixtures();

    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      taxId: tax.id,
      validUntil: null,
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
    await markQuotationAccepted({ quotationId: draft.id, actorId: seller.id });

    const actorId = await resolveSystemActorId();
    const order = await convertQuotationToOrder({ quotationId: draft.id, actorId });

    const quotationBeforeConvert = await prisma.quotation.findUniqueOrThrow({ where: { id: draft.id } });
    expect(order.taxId).toBe(tax.id);
    expect(order.taxTotal.toString()).toBe(quotationBeforeConvert.taxTotal.toString());
  });
});
