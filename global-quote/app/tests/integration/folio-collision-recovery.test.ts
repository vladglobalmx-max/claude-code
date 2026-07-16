import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { createQuotationDraft } from "@/lib/quotations/mutations";

const createdQuotationIds: string[] = [];

afterEach(async () => {
  while (createdQuotationIds.length > 0) {
    const id = createdQuotationIds.pop()!;
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.deleteMany({ where: { id } });
  }
});

async function fixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const seller = await prisma.user.findUniqueOrThrow({
    where: { email: "diego.ramirez@globalsuppliermty.com" },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { legalName: { contains: "Higiene del Norte" } },
  });
  return { businessUnit, seller, customer };
}

async function createOne(businessUnit: { id: string }, seller: { id: string; folioCode: string | null }, customer: { id: string }) {
  const quotation = await createQuotationDraft({
    businessUnitId: businessUnit.id,
    customerId: customer.id,
    sellerId: seller.id,
    sellerCode: seller.folioCode!,
    taxId: null,
    validUntil: null,
    notes: null,
  });
  createdQuotationIds.push(quotation.id);
  return quotation;
}

describe("createQuotationDraft self-heals from a desynced folio counter (docs/ARCHITECTURE.md §7.2)", () => {
  it("recovers automatically if sequence_settings falls one step behind the folios that already exist", async () => {
    const { businessUnit, seller, customer } = await fixtures();

    const first = await createOne(businessUnit, seller, customer);

    // Simula el desfase real que motivó este arreglo: el consecutivo
    // guardado queda atrás de lo que en verdad ya existe en `quotations`
    // (p. ej. tras una restauración de datos manual que no lo resincronizó).
    await prisma.sequenceSettings.updateMany({
      where: { businessUnitId: businessUnit.id, documentType: "QUOTATION" },
      data: { lastConsecutive: { decrement: 1 } },
    });

    // Sin la revisión de colisión, este consecutivo generaría el mismo
    // folio que `first` otra vez. issueFolioCore la detecta y reserva el
    // siguiente, dentro de la misma transacción, sin lanzar P2002.
    const second = await createOne(businessUnit, seller, customer);

    expect(second.folio).not.toBe(first.folio);
  });

  it("recovers even when the counter falls several steps behind, not just by one", async () => {
    const { businessUnit, seller, customer } = await fixtures();

    const existing = [
      await createOne(businessUnit, seller, customer),
      await createOne(businessUnit, seller, customer),
      await createOne(businessUnit, seller, customer),
    ];

    await prisma.sequenceSettings.updateMany({
      where: { businessUnitId: businessUnit.id, documentType: "QUOTATION" },
      data: { lastConsecutive: { decrement: 3 } },
    });

    const recovered = await createOne(businessUnit, seller, customer);

    expect(existing.map((q) => q.folio)).not.toContain(recovered.folio);
  });
});
