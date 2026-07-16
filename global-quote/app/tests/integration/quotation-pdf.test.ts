import { afterEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { prisma } from "@/lib/prisma/client";
import { addQuotationItem, createQuotationDraft, submitQuotation } from "@/lib/quotations/mutations";
import {
  QuotationNotFoundForPdfError,
  renderQuotationPdf,
} from "@/lib/pdf/render-quotation-pdf";

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
  const healthyProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-001" },
  });
  return { businessUnit, seller, customerWithPriceList, healthyProduct };
}

describe("renderQuotationPdf (docs/ARCHITECTURE.md §10, Módulo 9)", () => {
  it("renders a real single-page PDF for a sent quotation, with the GFB brand data seeded", async () => {
    const { businessUnit, seller, customerWithPriceList, healthyProduct } = await fixtures();
    const draft = await createQuotationDraft({
      businessUnitId: businessUnit.id,
      customerId: customerWithPriceList.id,
      sellerId: seller.id,
      sellerCode: seller.folioCode!,
      validUntil: null,
      notes: "Entrega en 5 días hábiles.",
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

    const buffer = await renderQuotationPdf(draft.id);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("paginates into multiple pages when the quotation has many line items", async () => {
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

    for (let i = 0; i < 50; i++) {
      await addQuotationItem({
        quotationId: draft.id,
        productId: healthyProduct.id,
        qty: 1,
        discountPct: 0,
        actorId: seller.id,
      });
    }
    await submitQuotation({ quotationId: draft.id, actorId: seller.id });

    const buffer = await renderQuotationPdf(draft.id);
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("throws for a quotation id that does not exist", async () => {
    await expect(
      renderQuotationPdf("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(QuotationNotFoundForPdfError);
  });
});
