import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addQuotationItem,
  createQuotationDraft,
  markQuotationAccepted,
  markQuotationRejectedByClient,
  submitQuotation,
} from "@/lib/quotations/mutations";
import { expireOverdueQuotations } from "@/lib/followups/mutations";
import { resolveSystemActorId } from "@/lib/followups/system-actor";
import { getDashboardKpis } from "@/lib/dashboard/queries";

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

async function createDraft(validUntil: string | null) {
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
  return { draft, seller };
}

describe("getDashboardKpis reconciliation (docs/ARCHITECTURE.md §9.2/§10, Módulo 13)", () => {
  it("the KPI totals for a known set of quotations match a direct sum in Postgres", async () => {
    const { draft: draftOnly } = await createDraft(null); // excluded: never quoted

    const { draft: sentDraft, seller } = await createDraft(null);
    await submitQuotation({ quotationId: sentDraft.id, actorId: seller.id });

    const { draft: acceptedDraft } = await createDraft(null);
    await submitQuotation({ quotationId: acceptedDraft.id, actorId: seller.id });
    await markQuotationAccepted({ quotationId: acceptedDraft.id, actorId: seller.id });

    const { draft: rejectedDraft } = await createDraft(null);
    await submitQuotation({ quotationId: rejectedDraft.id, actorId: seller.id });
    await markQuotationRejectedByClient({
      quotationId: rejectedDraft.id,
      actorId: seller.id,
      reason: "Precio",
    });

    const { draft: expiredDraft } = await createDraft("2020-01-01T00:00:00.000Z");
    await submitQuotation({ quotationId: expiredDraft.id, actorId: seller.id });
    const systemActorId = await resolveSystemActorId();
    await expireOverdueQuotations(new Date(), systemActorId);

    const ids = [draftOnly.id, sentDraft.id, acceptedDraft.id, rejectedDraft.id, expiredDraft.id];

    const kpis = await getDashboardKpis({ id: { in: ids } });

    // Suma directa contra Postgres, sin pasar por las funciones puras de kpis.ts.
    const directRows = await prisma.quotation.findMany({
      where: { id: { in: ids } },
      select: { status: true, total: true },
    });
    expect(directRows).toHaveLength(5);

    const directQuoted = directRows.filter((r) => r.status !== "DRAFT" && r.status !== "PENDING_APPROVAL");
    const directWon = directRows.filter((r) => r.status === "ACCEPTED" || r.status === "CONVERTED_TO_ORDER");
    const directLost = directRows.filter(
      (r) => r.status === "REJECTED" || r.status === "EXPIRED" || r.status === "CANCELLED",
    );
    const sum = (rows: typeof directRows) =>
      rows.reduce((acc, r) => acc + r.total.toNumber(), 0);

    expect(kpis.overall.quotedCount).toBe(directQuoted.length);
    expect(kpis.overall.quotedTotal.toNumber()).toBeCloseTo(sum(directQuoted), 8);
    expect(kpis.overall.wonCount).toBe(directWon.length);
    expect(kpis.overall.wonTotal.toNumber()).toBeCloseTo(sum(directWon), 8);
    expect(kpis.overall.lostCount).toBe(directLost.length);
    expect(kpis.overall.lostTotal.toNumber()).toBeCloseTo(sum(directLost), 8);

    // 4 cotizaciones realmente cotizadas: 1 draft excluido de los 5 totales.
    expect(kpis.overall.quotedCount).toBe(4);
    expect(kpis.overall.wonCount).toBe(1);
    expect(kpis.overall.lostCount).toBe(2);
    expect(kpis.overall.conversionRatePct?.toNumber()).toBeCloseTo((1 / 3) * 100, 8);

    // Se agrupan bajo GFB (única línea) y bajo el vendedor único de este fixture.
    expect(kpis.byBusinessUnit).toHaveLength(1);
    expect(kpis.byBusinessUnit[0].key).toBe("GFB");
    expect(kpis.byBusinessUnit[0].kpis.quotedCount).toBe(4);
    expect(kpis.bySeller).toHaveLength(1);
    expect(kpis.bySeller[0].kpis.quotedCount).toBe(4);

    expect(kpis.rows).toHaveLength(5);
  });

  it("returns all-zero KPIs for an empty scope, without throwing", async () => {
    const kpis = await getDashboardKpis({ id: "00000000-0000-0000-0000-000000000000" });
    expect(kpis.overall.quotedCount).toBe(0);
    expect(kpis.overall.quotedTotal.toNumber()).toBe(0);
    expect(kpis.overall.conversionRatePct).toBeNull();
    expect(kpis.byBusinessUnit).toEqual([]);
    expect(kpis.bySeller).toEqual([]);
  });
});
